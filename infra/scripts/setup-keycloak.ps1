$ErrorActionPreference = "Stop"

$container = "store-ops-keycloak"
$server = "http://localhost:8080"
$realm = "store-ops"
$clientId = "store-ops-admin-web"
$companyId = "00000000-0000-0000-0000-000000000001"
$regionId = "00000000-0000-0000-0000-000000000010"
$storeId = "00000000-0000-0000-0000-000000000100"
$defaultPassword = "StoreOps123!"
$adminUsername = "admin"
$adminPassword = "admin"

function Exec-Keycloak([string]$command) {
  docker exec $container /bin/sh -lc $command
}

function Copy-JsonToContainer([string]$json, [string]$containerPath) {
  $tempPath = New-TemporaryFile
  [System.IO.File]::WriteAllText(
    $tempPath,
    $json,
    [System.Text.UTF8Encoding]::new($false)
  )
  docker cp $tempPath "${container}:$containerPath" | Out-Null
  Remove-Item -LiteralPath $tempPath -Force
}

function Get-KeycloakAdminHeaders() {
  $tokenResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$server/realms/master/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
      grant_type = "password"
      client_id = "admin-cli"
      username = $adminUsername
      password = $adminPassword
    }

  return @{ Authorization = "Bearer $($tokenResponse.access_token)" }
}

function Get-UserAttributeValues($attributes, [string]$name) {
  if ($null -eq $attributes) {
    return @()
  }

  $property = $attributes.PSObject.Properties[$name]
  if ($null -eq $property -or $null -eq $property.Value) {
    return @()
  }

  return @($property.Value)
}

Write-Host "Configuring Keycloak admin session..."
Exec-Keycloak "/opt/keycloak/bin/kcadm.sh config credentials --server $server --realm master --user $adminUsername --password $adminPassword" | Out-Null

Write-Host "Recreating realm if it already exists..."
try {
  Exec-Keycloak "/opt/keycloak/bin/kcadm.sh delete realms/$realm" | Out-Null
} catch {
}

Write-Host "Creating realm..."
Exec-Keycloak "/opt/keycloak/bin/kcadm.sh create realms -s realm=$realm -s enabled=true -s displayName='Store Ops'" | Out-Null
Exec-Keycloak "/opt/keycloak/bin/kcadm.sh update users/profile -r $realm -s unmanagedAttributePolicy=ENABLED" | Out-Null

Write-Host "Creating realm roles..."
foreach ($role in @("SUPER_ADMIN","REPORT_VIEWER","STORE_MANAGER","STORE_PERSONNEL","REGION_MANAGER","AUDITOR","INTEGRATION_ADMIN","SNAPSHOT_OPERATOR")) {
  Exec-Keycloak "/opt/keycloak/bin/kcadm.sh create roles -r $realm -s name=$role" | Out-Null
}

Write-Host "Creating SPA client..."
$clientConfig = @"
{
  "clientId": "$clientId",
  "name": "Store Ops Admin Web",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "redirectUris": ["http://localhost:5173/auth/callback"],
  "webOrigins": ["http://localhost:5173"],
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "http://localhost:5173/auth/login"
  }
}
"@
Copy-JsonToContainer $clientConfig "/tmp/store-ops-admin-web-client.json"
Exec-Keycloak "/opt/keycloak/bin/kcadm.sh create clients -r $realm -f /tmp/store-ops-admin-web-client.json" | Out-Null

$clientUuid = (Exec-Keycloak "/opt/keycloak/bin/kcadm.sh get clients -r $realm -q clientId=$clientId --fields id --format csv --noquotes").Trim()

Write-Host "Creating protocol mappers..."
$rolesMapperConfig = @"
{
  "name": "roles",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usermodel-realm-role-mapper",
  "consentRequired": false,
  "config": {
    "multivalued": "true",
    "userinfo.token.claim": "true",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "claim.name": "roles",
    "jsonType.label": "String"
  }
}
"@
Copy-JsonToContainer $rolesMapperConfig "/tmp/store-ops-roles-mapper.json"
Exec-Keycloak "/opt/keycloak/bin/kcadm.sh create clients/$clientUuid/protocol-mappers/models -r $realm -f /tmp/store-ops-roles-mapper.json" | Out-Null

foreach ($attr in @("employee_id","company_ids","region_ids","store_ids","read_company_ids","read_region_ids","read_store_ids","assigned_store_ids")) {
  $attrMapperConfig = @"
{
  "name": "$attr",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usermodel-attribute-mapper",
  "consentRequired": false,
  "config": {
    "multivalued": "true",
    "user.attribute": "$attr",
    "claim.name": "$attr",
    "jsonType.label": "String",
    "access.token.claim": "true",
    "id.token.claim": "true",
    "userinfo.token.claim": "true"
  }
}
"@
  Copy-JsonToContainer $attrMapperConfig "/tmp/store-ops-$attr-mapper.json"
  Exec-Keycloak "/opt/keycloak/bin/kcadm.sh create clients/$clientUuid/protocol-mappers/models -r $realm -f /tmp/store-ops-$attr-mapper.json" | Out-Null
}

Write-Host "Creating users..."
$adminHeaders = Get-KeycloakAdminHeaders

function To-KeycloakArray([string[]]$values) {
  if ($null -eq $values -or $values.Count -eq 0) {
    return "[]"
  }

  return "[" + (($values | ForEach-Object { '"' + $_ + '"' }) -join ",") + "]"
}

$users = @(
  @{
    Username = "store.manager"
    Email = "store.manager@example.com"
    FirstName = "Store"
    LastName = "Manager"
    Roles = @("STORE_MANAGER")
    EmployeeId = "DEMO-EMP-201"
    CompanyIds = @($companyId)
    RegionIds = @($regionId)
    StoreIds = @($storeId)
    ReadCompanyIds = @($companyId)
    ReadRegionIds = @($regionId)
    ReadStoreIds = @($storeId)
    AssignedStoreIds = @($storeId)
  },
  @{
    Username = "store.personnel"
    Email = "store.personnel@example.com"
    FirstName = "Store"
    LastName = "Personnel"
    Roles = @("STORE_PERSONNEL")
    EmployeeId = "DEMO-EMP-202"
    CompanyIds = @($companyId)
    RegionIds = @($regionId)
    StoreIds = @($storeId)
    ReadCompanyIds = @($companyId)
    ReadRegionIds = @($regionId)
    ReadStoreIds = @($storeId)
    AssignedStoreIds = @($storeId)
  },
  @{
    Username = "region.manager"
    Email = "region.manager@example.com"
    FirstName = "Region"
    LastName = "Manager"
    Roles = @("REGION_MANAGER")
    EmployeeId = "DEMO-EMP-203"
    CompanyIds = @($companyId)
    RegionIds = @($regionId)
    StoreIds = @()
    ReadCompanyIds = @($companyId)
    ReadRegionIds = @($regionId)
    ReadStoreIds = @()
    AssignedStoreIds = @($storeId)
  },
  @{
    Username = "admin.operator"
    Email = "admin.operator@example.com"
    FirstName = "Admin"
    LastName = "Operator"
    Roles = @("SUPER_ADMIN","REPORT_VIEWER")
    EmployeeId = "DEMO-EMP-201"
    CompanyIds = @($companyId)
    RegionIds = @($regionId)
    StoreIds = @($storeId)
    ReadCompanyIds = @($companyId)
    ReadRegionIds = @($regionId)
    ReadStoreIds = @($storeId)
    AssignedStoreIds = @($storeId)
  }
)

foreach ($user in $users) {
  Exec-Keycloak "/opt/keycloak/bin/kcadm.sh create users -r $realm -s username=$($user.Username) -s enabled=true -s email=$($user.Email) -s firstName=$($user.FirstName) -s lastName=$($user.LastName)" | Out-Null
  $userId = (Exec-Keycloak "/opt/keycloak/bin/kcadm.sh get users -r $realm -q username=$($user.Username) --fields id --format csv --noquotes").Trim()

  Write-Host "Setting password for $($user.Username)..."
  Exec-Keycloak "/opt/keycloak/bin/kcadm.sh set-password -r $realm --userid $userId --new-password $defaultPassword" | Out-Null

  Write-Host "Assigning attributes for $($user.Username)..."
  $employeeIdsJson = To-KeycloakArray @($user.EmployeeId)
  $companyIdsJson = To-KeycloakArray $user.CompanyIds
  $regionIdsJson = To-KeycloakArray $user.RegionIds
  $storeIdsJson = To-KeycloakArray $user.StoreIds
  $readCompanyIdsJson = To-KeycloakArray $user.ReadCompanyIds
  $readRegionIdsJson = To-KeycloakArray $user.ReadRegionIds
  $readStoreIdsJson = To-KeycloakArray $user.ReadStoreIds
  $assignedStoreIdsJson = To-KeycloakArray $user.AssignedStoreIds
  $userUpdateConfig = @"
{
  "email": "$($user.Email)",
  "emailVerified": true,
  "firstName": "$($user.FirstName)",
  "lastName": "$($user.LastName)",
  "requiredActions": [],
  "attributes": {
    "employee_id": $employeeIdsJson,
    "company_ids": $companyIdsJson,
    "region_ids": $regionIdsJson,
    "store_ids": $storeIdsJson,
    "read_company_ids": $readCompanyIdsJson,
    "read_region_ids": $readRegionIdsJson,
    "read_store_ids": $readStoreIdsJson,
    "assigned_store_ids": $assignedStoreIdsJson
  }
}
"@
  $safeUsername = $user.Username -replace "[^a-zA-Z0-9_-]", "-"
  Copy-JsonToContainer $userUpdateConfig "/tmp/store-ops-$safeUsername-attributes.json"
  Invoke-RestMethod `
    -Method Put `
    -Uri "$server/admin/realms/$realm/users/$userId" `
    -Headers $adminHeaders `
    -ContentType "application/json" `
    -Body $userUpdateConfig | Out-Null

  $updatedUser = Invoke-RestMethod `
    -Method Get `
    -Uri "$server/admin/realms/$realm/users/$userId" `
    -Headers $adminHeaders

  if (
    $updatedUser.email -ne $user.Email -or
    $updatedUser.firstName -ne $user.FirstName -or
    $updatedUser.lastName -ne $user.LastName -or
    $updatedUser.emailVerified -ne $true
  ) {
    throw "Keycloak user profile write failed for $($user.Username)."
  }

  foreach ($requiredAttribute in @("employee_id","company_ids","read_company_ids","read_region_ids","assigned_store_ids")) {
    if ((Get-UserAttributeValues $updatedUser.attributes $requiredAttribute).Count -eq 0) {
      throw "Keycloak user attribute '$requiredAttribute' was not written for $($user.Username)."
    }
  }

  Write-Host "Assigning roles for $($user.Username)..."
  foreach ($role in $user.Roles) {
    Exec-Keycloak "/opt/keycloak/bin/kcadm.sh add-roles -r $realm --uusername $($user.Username) --rolename $role" | Out-Null
  }
}

Write-Host ""
Write-Host "Keycloak setup completed."
Write-Host "Realm: $realm"
Write-Host "Client: $clientId"
Write-Host "Users:"
Write-Host "  store.manager / StoreOps123!"
Write-Host "  store.personnel / StoreOps123!"
Write-Host "  region.manager / StoreOps123!"
Write-Host "  admin.operator / StoreOps123!"
