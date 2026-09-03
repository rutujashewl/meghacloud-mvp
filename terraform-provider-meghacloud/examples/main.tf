terraform {
  required_providers {
    meghacloud = {
      source  = "meghacloud/meghacloud"
      version = "1.0.0"
    }
  }
}

provider "meghacloud" {
  api_url = var.api_url
  api_key = var.api_key
}

resource "meghacloud_server" "demo" {
  name   = "terraform-demo"
  os     = "Ubuntu 22.04"
  size   = "small"
  region = "Mumbai"
}

variable "api_url" {
  type    = string
  default = "http://localhost:4000/api"
}

variable "api_key" {
  type      = string
  sensitive = true
}
