using System.Data;
using System.Data.Common;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();

var app = builder.Build();

var connectionString = builder.Configuration.GetConnectionString("DD35Util")
    ?? throw new InvalidOperationException("Connection string 'DD35Util' is required.");

app.MapGet("/", () => Results.Redirect("/health"));

app.MapGet("/health", async () =>
{
    await using var connection = OpenConnection(connectionString);
    await using var command = CreateCommand(connection, "SELECT COUNT(*) FROM dbo.[dd55e.Creatures];");
    var count = Convert.ToInt32(await command.ExecuteScalarAsync());

    return Results.Ok(new
    {
        status = "ok",
        database = "DD35Util",
        creatures = count
    });
});

app.MapGet("/api/creatures", async (
    string? q,
    bool? animal,
    string? cr,
    int? skip,
    int? take) =>
{
    var limit = Math.Clamp(take ?? 50, 1, 200);
    var offset = Math.Max(skip ?? 0, 0);

    var filters = new List<string>();
    var parameters = new List<object?>();

    if (!string.IsNullOrWhiteSpace(q))
    {
        filters.Add("Name LIKE @q");
        parameters.Add($"%{q.Trim()}%");
    }

    if (animal is not null)
    {
        filters.Add("IsAnimal = @animal");
        parameters.Add(animal.Value ? 1 : 0);
    }

    if (!string.IsNullOrWhiteSpace(cr))
    {
        filters.Add("ChallengeRating = @cr");
        parameters.Add(cr.Trim());
    }

    var where = filters.Count == 0 ? "" : "WHERE " + string.Join(" AND ", filters);
    var sql = $"""
        SELECT CreatureId, Name, Size, CreatureType, Alignment, ArmorClass, HitPoints,
               ChallengeRating, Xp, ProficiencyBonus, SourceSection, IsAnimal
        FROM dbo.[dd55e.Creatures]
        {where}
        ORDER BY Name
        OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY;
        """;

    parameters.Add(offset);
    parameters.Add(limit);

    await using var connection = OpenConnection(connectionString);
    await using var command = CreateCommand(connection, sql, parameters);
    await using var reader = await command.ExecuteReaderAsync();

    var creatures = new List<CreatureSummary>();
    while (await reader.ReadAsync())
    {
        creatures.Add(new CreatureSummary(
            reader.GetInt32("CreatureId"),
            reader.GetString("Name"),
            reader.GetNullableString("Size"),
            reader.GetNullableString("CreatureType"),
            reader.GetNullableString("Alignment"),
            reader.GetNullableInt32("ArmorClass"),
            reader.GetNullableInt32("HitPoints"),
            reader.GetNullableString("ChallengeRating"),
            reader.GetNullableInt32("Xp"),
            reader.GetNullableInt32("ProficiencyBonus"),
            reader.GetNullableString("SourceSection"),
            reader.GetBoolean("IsAnimal")));
    }

    return Results.Ok(new { skip = offset, take = limit, count = creatures.Count, items = creatures });
});

app.MapGet("/api/creatures/{id:int}", async (int id) =>
{
    const string sql = """
        SELECT CreatureId, SourceCreatureKey, Name, Size, CreatureType, Alignment, ArmorClass,
               InitiativeBonus, InitiativeScore, HitPoints, HitPointFormula, SpeedText,
               ChallengeRating, Xp, LairXp, ProficiencyBonus, SensesText, PassivePerception,
               LanguagesText, SourceUrl, SourceSection, IsAnimal, RawStatBlockText
        FROM dbo.[dd55e.Creatures]
        WHERE CreatureId = @id;
        """;

    await using var connection = OpenConnection(connectionString);
    await using var command = CreateCommand(connection, sql, [id]);
    await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow);

    if (!await reader.ReadAsync())
    {
        return Results.NotFound();
    }

    var creature = new CreatureDetail(
        reader.GetInt32("CreatureId"),
        reader.GetNullableString("SourceCreatureKey"),
        reader.GetString("Name"),
        reader.GetNullableString("Size"),
        reader.GetNullableString("CreatureType"),
        reader.GetNullableString("Alignment"),
        reader.GetNullableInt32("ArmorClass"),
        reader.GetNullableInt32("InitiativeBonus"),
        reader.GetNullableInt32("InitiativeScore"),
        reader.GetNullableInt32("HitPoints"),
        reader.GetNullableString("HitPointFormula"),
        reader.GetNullableString("SpeedText"),
        reader.GetNullableString("ChallengeRating"),
        reader.GetNullableInt32("Xp"),
        reader.GetNullableInt32("LairXp"),
        reader.GetNullableInt32("ProficiencyBonus"),
        reader.GetNullableString("SensesText"),
        reader.GetNullableInt32("PassivePerception"),
        reader.GetNullableString("LanguagesText"),
        reader.GetNullableString("SourceUrl"),
        reader.GetNullableString("SourceSection"),
        reader.GetBoolean("IsAnimal"),
        reader.GetNullableString("RawStatBlockText"));

    return Results.Ok(creature);
});

app.MapGet("/api/creatures/{id:int}/abilities", async (int id) =>
{
    const string sql = """
        SELECT AbilityCode, Score, Modifier, SaveBonus
        FROM dbo.[dd55e.CreatureAbilityScores]
        WHERE CreatureId = @id
        ORDER BY CreatureAbilityScoreId;
        """;

    return Results.Ok(await QueryList(connectionString, sql, [id], reader => new AbilityScore(
        reader.GetString("AbilityCode").Trim(),
        reader.GetInt32("Score"),
        reader.GetInt32("Modifier"),
        reader.GetNullableInt32("SaveBonus"))));
});

app.MapGet("/api/creatures/{id:int}/features", async (int id) =>
{
    const string sql = """
        SELECT SectionName, FeatureName, UsageText, RechargeText, FeatureText, SortOrder
        FROM dbo.[dd55e.CreatureFeatures]
        WHERE CreatureId = @id
        ORDER BY SortOrder, CreatureFeatureId;
        """;

    return Results.Ok(await QueryList(connectionString, sql, [id], reader => new CreatureFeature(
        reader.GetString("SectionName"),
        reader.GetString("FeatureName"),
        reader.GetNullableString("UsageText"),
        reader.GetNullableString("RechargeText"),
        reader.GetString("FeatureText"),
        reader.GetInt32("SortOrder"))));
});

app.MapGet("/api/creatures/{id:int}/defenses", async (int id) =>
{
    const string sql = """
        SELECT DefenseType, DefenseName, RawText
        FROM dbo.[dd55e.CreatureDefenses]
        WHERE CreatureId = @id
        ORDER BY CreatureDefenseId;
        """;

    return Results.Ok(await QueryList(connectionString, sql, [id], reader => new CreatureDefense(
        reader.GetString("DefenseType"),
        reader.GetString("DefenseName"),
        reader.GetNullableString("RawText"))));
});

app.MapGet("/api/creatures/{id:int}/speeds", async (int id) =>
{
    const string sql = """
        SELECT SpeedType, DistanceFeet, Qualifier, RawText
        FROM dbo.[dd55e.CreatureSpeeds]
        WHERE CreatureId = @id
        ORDER BY CreatureSpeedId;
        """;

    return Results.Ok(await QueryList(connectionString, sql, [id], reader => new CreatureSpeed(
        reader.GetString("SpeedType"),
        reader.GetNullableInt32("DistanceFeet"),
        reader.GetNullableString("Qualifier"),
        reader.GetString("RawText"))));
});

app.Run();

static SqlConnection OpenConnection(string connectionString)
{
    var connection = new SqlConnection(connectionString);
    connection.Open();
    return connection;
}

static SqlCommand CreateCommand(SqlConnection connection, string sql, IReadOnlyList<object?>? parameters = null)
{
    var command = connection.CreateCommand();
    command.CommandText = sql;

    if (parameters is null)
    {
        return command;
    }

    var parameterNames = ExtractParameterNames(sql);
    for (var i = 0; i < parameters.Count; i++)
    {
        var name = i < parameterNames.Count ? parameterNames[i] : $"@p{i}";
        command.Parameters.Add(new SqlParameter(name, parameters[i] ?? DBNull.Value));
    }

    return command;
}

static List<string> ExtractParameterNames(string sql)
{
    var names = new List<string>();
    foreach (System.Text.RegularExpressions.Match match in System.Text.RegularExpressions.Regex.Matches(sql, @"@\w+"))
    {
        var name = match.Value;
        if (!names.Contains(name, StringComparer.OrdinalIgnoreCase))
        {
            names.Add(name);
        }
    }

    return names;
}

static async Task<List<T>> QueryList<T>(
    string connectionString,
    string sql,
    IReadOnlyList<object?> parameters,
    Func<DbDataReader, T> map)
{
    await using var connection = OpenConnection(connectionString);
    await using var command = CreateCommand(connection, sql, parameters);
    await using var reader = await command.ExecuteReaderAsync();

    var items = new List<T>();
    while (await reader.ReadAsync())
    {
        items.Add(map(reader));
    }

    return items;
}

static class DataReaderExtensions
{
    public static string GetString(this DbDataReader reader, string name) =>
        reader.GetString(reader.GetOrdinal(name));

    public static int GetInt32(this DbDataReader reader, string name) =>
        reader.GetInt32(reader.GetOrdinal(name));

    public static bool GetBoolean(this DbDataReader reader, string name) =>
        reader.GetBoolean(reader.GetOrdinal(name));

    public static string? GetNullableString(this DbDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    public static int? GetNullableInt32(this DbDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
    }
}

record CreatureSummary(
    int CreatureId,
    string Name,
    string? Size,
    string? CreatureType,
    string? Alignment,
    int? ArmorClass,
    int? HitPoints,
    string? ChallengeRating,
    int? Xp,
    int? ProficiencyBonus,
    string? SourceSection,
    bool IsAnimal);

record CreatureDetail(
    int CreatureId,
    string? SourceCreatureKey,
    string Name,
    string? Size,
    string? CreatureType,
    string? Alignment,
    int? ArmorClass,
    int? InitiativeBonus,
    int? InitiativeScore,
    int? HitPoints,
    string? HitPointFormula,
    string? SpeedText,
    string? ChallengeRating,
    int? Xp,
    int? LairXp,
    int? ProficiencyBonus,
    string? SensesText,
    int? PassivePerception,
    string? LanguagesText,
    string? SourceUrl,
    string? SourceSection,
    bool IsAnimal,
    string? RawStatBlockText);

record AbilityScore(string AbilityCode, int Score, int Modifier, int? SaveBonus);
record CreatureFeature(string SectionName, string FeatureName, string? UsageText, string? RechargeText, string FeatureText, int SortOrder);
record CreatureDefense(string DefenseType, string DefenseName, string? RawText);
record CreatureSpeed(string SpeedType, int? DistanceFeet, string? Qualifier, string RawText);
