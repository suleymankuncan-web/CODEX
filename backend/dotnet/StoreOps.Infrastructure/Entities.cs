namespace StoreOps.Infrastructure.Entities;

public sealed class CompanyEntity
{
    public Guid CompanyId { get; set; }
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
}

public sealed class RegionEntity
{
    public Guid RegionId { get; set; }
    public Guid CompanyId { get; set; }
    public string RegionCode { get; set; } = string.Empty;
    public string RegionName { get; set; } = string.Empty;
}

public sealed class StoreEntity
{
    public Guid StoreId { get; set; }
    public Guid CompanyId { get; set; }
    public Guid RegionId { get; set; }
    public string StoreCode { get; set; } = string.Empty;
    public string StoreName { get; set; } = string.Empty;
    public string StoreType { get; set; } = string.Empty;
}

public sealed class EmployeeEntity
{
    public Guid EmployeeId { get; set; }
    public Guid CompanyId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateOnly HireDate { get; set; }
    public string EmploymentStatus { get; set; } = "active";
}

public sealed class EmployeeAssignmentEntity
{
    public Guid AssignmentId { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid StoreId { get; set; }
    public Guid RegionId { get; set; }
    public Guid PositionId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public decimal FteRatio { get; set; }
}

public sealed class ChecklistInstanceEntity
{
    public Guid ChecklistInstanceId { get; set; }
    public Guid ChecklistTemplateId { get; set; }
    public Guid StoreId { get; set; }
    public string Status { get; set; } = "planned";
    public decimal? TotalScore { get; set; }
    public decimal? ComplianceRate { get; set; }
}

public sealed class KpiActualEntity
{
    public Guid KpiActualId { get; set; }
    public Guid KpiId { get; set; }
    public string ScopeType { get; set; } = string.Empty;
    public Guid? StoreId { get; set; }
    public Guid? EmployeeId { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public decimal ActualValue { get; set; }
}

public sealed class SnapshotRunEntity
{
    public Guid SnapshotRunId { get; set; }
    public DateOnly SnapshotDate { get; set; }
    public string SnapshotType { get; set; } = string.Empty;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateTimeOffset GeneratedAt { get; set; }
    public string GeneratedBy { get; set; } = string.Empty;
}
