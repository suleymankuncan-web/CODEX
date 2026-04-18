using Microsoft.EntityFrameworkCore;
using StoreOps.Infrastructure.Entities;

namespace StoreOps.Infrastructure;

public sealed class StoreOpsDbContext : DbContext
{
    public StoreOpsDbContext(DbContextOptions<StoreOpsDbContext> options) : base(options)
    {
    }

    public DbSet<CompanyEntity> Companies => Set<CompanyEntity>();
    public DbSet<RegionEntity> Regions => Set<RegionEntity>();
    public DbSet<StoreEntity> Stores => Set<StoreEntity>();
    public DbSet<EmployeeEntity> Employees => Set<EmployeeEntity>();
    public DbSet<EmployeeAssignmentEntity> EmployeeAssignments => Set<EmployeeAssignmentEntity>();
    public DbSet<ChecklistInstanceEntity> ChecklistInstances => Set<ChecklistInstanceEntity>();
    public DbSet<KpiActualEntity> KpiActuals => Set<KpiActualEntity>();
    public DbSet<SnapshotRunEntity> SnapshotRuns => Set<SnapshotRunEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("ops");

        modelBuilder.Entity<CompanyEntity>(entity =>
        {
            entity.ToTable("company", "ops");
            entity.HasKey(x => x.CompanyId);
            entity.HasIndex(x => x.CompanyCode).IsUnique();
        });

        modelBuilder.Entity<RegionEntity>(entity =>
        {
            entity.ToTable("region", "ops");
            entity.HasKey(x => x.RegionId);
            entity.HasOne<CompanyEntity>().WithMany().HasForeignKey(x => x.CompanyId);
        });

        modelBuilder.Entity<StoreEntity>(entity =>
        {
            entity.ToTable("store", "ops");
            entity.HasKey(x => x.StoreId);
            entity.HasIndex(x => x.StoreCode).IsUnique();
        });

        modelBuilder.Entity<EmployeeEntity>(entity =>
        {
            entity.ToTable("employee", "ops");
            entity.HasKey(x => x.EmployeeId);
        });

        modelBuilder.Entity<EmployeeAssignmentEntity>(entity =>
        {
            entity.ToTable("employee_assignment_history", "ops");
            entity.HasKey(x => x.AssignmentId);
        });

        modelBuilder.Entity<ChecklistInstanceEntity>(entity =>
        {
            entity.ToTable("checklist_instance", "ops");
            entity.HasKey(x => x.ChecklistInstanceId);
        });

        modelBuilder.Entity<KpiActualEntity>(entity =>
        {
            entity.ToTable("kpi_actual", "ops");
            entity.HasKey(x => x.KpiActualId);
        });

        modelBuilder.Entity<SnapshotRunEntity>(entity =>
        {
            entity.ToTable("snapshot_run", "rpt");
            entity.HasKey(x => x.SnapshotRunId);
        });
    }
}
