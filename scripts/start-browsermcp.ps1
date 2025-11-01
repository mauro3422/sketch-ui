Param(
    [string]$ArgsLine = ""
)

Write-Host "Launching browsermcp MCP server via npx..."
$command = "npx @browsermcp/mcp@latest $ArgsLine"
Invoke-Expression $command
