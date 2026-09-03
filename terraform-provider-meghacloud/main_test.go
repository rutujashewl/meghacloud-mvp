package main

import (
	"encoding/json"
	"testing"
)

func TestServerIDAcceptsNumberAndString(t *testing.T) {
	for _, input := range []string{`123`, `"123"`} {
		var response struct {
			Server serverResponse `json:"server"`
		}
		if err := json.Unmarshal([]byte(`{"server":{"id":`+input+`}}`), &response); err != nil {
			t.Fatalf("decode %s: %v", input, err)
		}
		if response.Server.ID != "123" {
			t.Fatalf("decode %s produced ID %q", input, response.Server.ID)
		}
	}
}
