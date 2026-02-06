# UDP API Documentation

Device listens on UDP Port **8888**.
All commands must be sent as a JSON string.

## Commands

### 1. Basic Control

**Turn All On**
```json
{"cmd": "all_on"}
```

**Turn All Off**
```json
{"cmd": "all_off"}
```

**Set Solid Color**
```json
{"cmd": "color", "r": 255, "g": 0, "b": 0}
```

**Set Single Pixel**
```json
{"cmd": "pixel", "idx": 0, "r": 255, "g": 255, "b": 255}
```

### 2. Configuration

**Get Full Configuration**
Returns the current configuration JSON to the sender's IP/Port.
```json
{"cmd": "get_config"}
```

**Update Configuration**
Update one or more settings. Only specified fields are updated.
```json
{
  "cmd": "config",
  "effect": 1,
  "flow_speed": 50,
  "bright": 200
  // ... any other config keys
}
```
*Note: To update WiFi via this command, you must provide the full `wifi` array.*

**Save Configuration**
Persist current settings to flash.
```json
{"cmd": "save"}
```

**Load Configuration**
Reload settings from flash (reverts unsaved changes).
```json
{"cmd": "load"}
```

### 3. WiFi Management

**Add WiFi Network**
Appends a new network to the list. Does NOT auto-save (send `{"cmd": "save"}` afterwards).
```json
{
  "cmd": "wifi_add",
  "ssid": "MyNetwork",
  "pass": "OpenSesame"
}
```

**Clear WiFi Networks**
Removes ALL configured networks. Does NOT auto-save.
```json
{"cmd": "wifi_clear"}
```
