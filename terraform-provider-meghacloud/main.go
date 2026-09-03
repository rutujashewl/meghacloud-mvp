package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	"github.com/hashicorp/terraform-plugin-sdk/v2/diag"
	"github.com/hashicorp/terraform-plugin-sdk/v2/plugin"
)

type apiClient struct { baseURL, apiKey string }

func main() { plugin.Serve(&plugin.ServeOpts{ProviderFunc: func() *schema.Provider { return provider() }}) }

func provider() *schema.Provider {
	p := &schema.Provider{
		Schema: map[string]*schema.Schema{
			"api_url": {Type: schema.TypeString, Optional: true, DefaultFunc: schema.EnvDefaultFunc("MEGHACLOUD_API_URL", "http://localhost:4000/api")},
			"api_key": {Type: schema.TypeString, Required: true, Sensitive: true, DefaultFunc: schema.EnvDefaultFunc("MEGHACLOUD_API_KEY", nil)},
		},
		ResourcesMap: map[string]*schema.Resource{"meghacloud_server": serverResource()},
	}
	p.ConfigureContextFunc = func(ctx context.Context, d *schema.ResourceData) (interface{}, diag.Diagnostics) { return &apiClient{baseURL: d.Get("api_url").(string), apiKey: d.Get("api_key").(string)}, nil }
	return p
}

func serverResource() *schema.Resource {
	return &schema.Resource{CreateContext: createServer, ReadContext: readServer, UpdateContext: updateServer, DeleteContext: deleteServer, Schema: map[string]*schema.Schema{
		"name": {Type: schema.TypeString, Required: true}, "os": {Type: schema.TypeString, Optional: true, Default: "Ubuntu 22.04"}, "size": {Type: schema.TypeString, Optional: true, Default: "small"}, "region": {Type: schema.TypeString, Optional: true, Default: "Mumbai"}, "status": {Type: schema.TypeString, Computed: true},
	}}
}

func request(c *apiClient, method, path string, payload interface{}, out interface{}) error {
	var body io.Reader
	if payload != nil { data, err := json.Marshal(payload); if err != nil { return err }; body = bytes.NewReader(data) }
	req, err := http.NewRequest(method, c.baseURL+path, body); if err != nil { return err }
	req.Header.Set("Authorization", "Bearer "+c.apiKey); req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req); if err != nil { return err }; defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound { return os.ErrNotExist }
	if res.StatusCode >= 300 { data, _ := io.ReadAll(res.Body); return fmt.Errorf("MeghaCloud API (%d): %s", res.StatusCode, data) }
	if out != nil { return json.NewDecoder(res.Body).Decode(out) }; return nil
}

func createServer(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	var result struct{ Server struct{ ID, Name, OS, Size, Region, Status string } `json:"server"` }
	err := request(meta.(*apiClient), http.MethodPost, "/servers", map[string]string{"name": d.Get("name").(string), "os": d.Get("os").(string), "size": d.Get("size").(string), "region": d.Get("region").(string)}, &result)
	if err != nil { return diag.Errorf("create server: %v", err) }; d.SetId(result.Server.ID); return readServer(ctx, d, meta)
}
func readServer(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	var result struct{ Server map[string]interface{} `json:"server"` }; err := request(meta.(*apiClient), http.MethodGet, "/servers/"+d.Id(), nil, &result)
	if err == os.ErrNotExist { d.SetId(""); return nil }; if err != nil { return diag.Errorf("read server: %v", err) }
	for _, field := range []string{"name", "os", "size", "region", "status"} { if value, ok := result.Server[field]; ok { _ = d.Set(field, value) } }; return nil
}
func updateServer(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics {
	if d.HasChanges("name", "os", "size", "region") {
		payload := map[string]string{"name": d.Get("name").(string), "os": d.Get("os").(string), "size": d.Get("size").(string), "region": d.Get("region").(string)}
		if err := request(meta.(*apiClient), http.MethodPatch, "/servers/"+d.Id(), payload, nil); err != nil { return diag.Errorf("update server: %v", err) }
	}
	return readServer(ctx, d, meta)
}
func deleteServer(ctx context.Context, d *schema.ResourceData, meta interface{}) diag.Diagnostics { err := request(meta.(*apiClient), http.MethodDelete, "/servers/"+d.Id(), nil, nil); if err != nil && err != os.ErrNotExist { return diag.Errorf("delete server: %v", err) }; d.SetId(""); return nil }
