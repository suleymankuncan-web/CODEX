# Role-Based Access Hardening Design

## Scope

Bu dilim mevcut scope tabanlı korumayı rol tabanlı koruma ile tamamlar.

## Problem

Şu an bir kullanıcı doğrulanıp doğru scope içinde olduğu sürece kritik endpoint'lere erişebiliyor. Bu, özellikle import, snapshot ve reporting yüzeyi için fazla gevşek.

## Yaklaşım

- Yeni decorator: `RequireRoles(...roleCodes)`
- Yeni global guard: `RoleGuard`
- `SUPER_ADMIN` bypass rolü olacak
- Endpoint bazında minimum rol seti tanımlanacak

## İlk Rol Matrisi

- Import command/read:
  - `SUPER_ADMIN`
  - `INTEGRATION_ADMIN`
- Snapshot command/read:
  - `SUPER_ADMIN`
  - `SNAPSHOT_OPERATOR`
- Reporting read:
  - `SUPER_ADMIN`
  - `REPORT_VIEWER`
  - `AUDITOR`
- Checklist command:
  - `SUPER_ADMIN`
  - `AUDITOR`

## Mock Auth Provider

Mock auth provider artık `x-role-codes` header'ını okuyacak. Böylece integration test'lerde gerçek role matrix doğrulanabilir.

## Goal

Command ve read yüzeyleri artık hem:
- kimlik
- scope
- rol

kontrolünden geçecek.
