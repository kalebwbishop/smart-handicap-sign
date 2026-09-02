using Npgsql;
using NpgsqlTypes;

namespace DeployBox.HazardHero.FunctionApp;

public sealed class SignalClassificationResultRepository
{
    private readonly NpgsqlDataSource _dataSource;

    public SignalClassificationResultRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<bool> PersistAndUpdateDeviceAsync(
        SignalClassificationResult result,
        string payload,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(result.MessageId, out var messageId) ||
            !DateTimeOffset.TryParse(result.OccurredAt, out var occurredAt) ||
            result.Classification is null ||
            result.Classification.Label is null ||
            result.Classification.Confidence is null ||
            result.DeviceId is null ||
            result.SchemaVersion is null)
        {
            throw new ArgumentException(
                "The classification result must be validated before persistence.",
                nameof(result));
        }

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await using var insertCommand = connection.CreateCommand();
        insertCommand.Transaction = transaction;
        insertCommand.CommandText =
            """
            INSERT INTO signal_classification_results
                (message_id, schema_version, occurred_at, device_id, label, confidence, payload)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (message_id) DO NOTHING;
            """;

        insertCommand.Parameters.Add(new NpgsqlParameter<Guid> { TypedValue = messageId });
        insertCommand.Parameters.Add(new NpgsqlParameter<string> { TypedValue = result.SchemaVersion });
        insertCommand.Parameters.Add(
            new NpgsqlParameter<DateTime> { TypedValue = occurredAt.UtcDateTime });
        insertCommand.Parameters.Add(new NpgsqlParameter<string> { TypedValue = result.DeviceId });
        insertCommand.Parameters.Add(new NpgsqlParameter<string> { TypedValue = result.Classification.Label });
        insertCommand.Parameters.Add(
            new NpgsqlParameter<double> { TypedValue = result.Classification.Confidence.Value });
        insertCommand.Parameters.Add(
            new NpgsqlParameter<string>
            {
                NpgsqlDbType = NpgsqlDbType.Jsonb,
                TypedValue = payload
            });

        var inserted = await insertCommand.ExecuteNonQueryAsync(cancellationToken) == 1;

        await using var updateCommand = connection.CreateCommand();
        updateCommand.Transaction = transaction;
        updateCommand.CommandText =
            """
            UPDATE devices
            SET operational_status = $1,
                connectivity_status = 'online',
                last_seen_at = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE device_id = $3
              AND (last_seen_at IS NULL OR last_seen_at <= $2);
            """;
        updateCommand.Parameters.Add(
            new NpgsqlParameter<string>
            {
                NpgsqlDbType = NpgsqlDbType.Varchar,
                TypedValue = result.Classification.Label == "positive"
                    ? "assistance_requested"
                    : "available"
            });
        updateCommand.Parameters.Add(
            new NpgsqlParameter<DateTime> { TypedValue = occurredAt.UtcDateTime });
        updateCommand.Parameters.Add(new NpgsqlParameter<string> { TypedValue = result.DeviceId });

        if (await updateCommand.ExecuteNonQueryAsync(cancellationToken) == 0)
        {
            await using var deviceCommand = connection.CreateCommand();
            deviceCommand.Transaction = transaction;
            deviceCommand.CommandText = "SELECT EXISTS (SELECT 1 FROM devices WHERE device_id = $1);";
            deviceCommand.Parameters.Add(new NpgsqlParameter<string> { TypedValue = result.DeviceId });

            if (!Convert.ToBoolean(await deviceCommand.ExecuteScalarAsync(cancellationToken)))
            {
                throw new InvalidOperationException(
                    $"No device exists for device_id '{result.DeviceId}'.");
            }
        }

        await transaction.CommitAsync(cancellationToken);
        return inserted;
    }

    public async Task<DeviceAcknowledgeResult> AcknowledgeDeviceAsync(
        string deviceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            WITH updated AS (
                UPDATE devices
                SET operational_status = 'assistance_in_progress',
                    updated_at = CURRENT_TIMESTAMP
                WHERE device_id = $1
                  AND operational_status = 'assistance_requested'
                RETURNING device_id, operational_status
            )
            SELECT device_id, operational_status, TRUE AS acknowledged
            FROM updated
            UNION ALL
            SELECT device_id, operational_status, FALSE AS acknowledged
            FROM devices
            WHERE device_id = $1
              AND NOT EXISTS (SELECT 1 FROM updated)
            LIMIT 1;
            """;
        command.Parameters.Add(new NpgsqlParameter<string> { TypedValue = deviceId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new DeviceAcknowledgeResult(false, false, null);
        }

        return new DeviceAcknowledgeResult(
            true,
            reader.GetBoolean(2),
            reader.GetString(1));
    }

    public async Task<DeviceResolveResult> ResolveDeviceAsync(
        string deviceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            WITH updated AS (
                UPDATE devices
                SET operational_status = 'available',
                    updated_at = CURRENT_TIMESTAMP
                WHERE device_id = $1
                  AND operational_status = 'assistance_in_progress'
                RETURNING device_id, operational_status
            )
            SELECT device_id, operational_status, TRUE AS resolved
            FROM updated
            UNION ALL
            SELECT device_id, operational_status, FALSE AS resolved
            FROM devices
            WHERE device_id = $1
              AND NOT EXISTS (SELECT 1 FROM updated)
            LIMIT 1;
            """;
        command.Parameters.Add(new NpgsqlParameter<string> { TypedValue = deviceId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new DeviceResolveResult(false, false, null);
        }

        return new DeviceResolveResult(
            true,
            reader.GetBoolean(2),
            reader.GetString(1));
    }

    public async Task<IReadOnlyList<DeviceRecord>> GetDevicesAsync(
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT device_id, serial_number, model_code, hardware_revision,
                   firmware_version, lifecycle_status, connectivity_status,
                   operational_status, battery_percentage, last_seen_at,
                   created_at, updated_at
            FROM devices
            ORDER BY device_id;
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var devices = new List<DeviceRecord>();
        while (await reader.ReadAsync(cancellationToken))
        {
            devices.Add(ReadDevice(reader));
        }

        return devices;
    }

    public async Task<DeviceRecord?> GetDeviceAsync(
        string deviceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT device_id, serial_number, model_code, hardware_revision,
                   firmware_version, lifecycle_status, connectivity_status,
                   operational_status, battery_percentage, last_seen_at,
                   created_at, updated_at
            FROM devices
            WHERE device_id = $1;
            """;
        command.Parameters.Add(new NpgsqlParameter<string> { TypedValue = deviceId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? ReadDevice(reader)
            : null;
    }

    public async Task<IReadOnlyList<string>> GetDevicePushTokensAsync(
        string deviceId,
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT expo_push_token
            FROM device_push_tokens
            WHERE device_id = $1
              AND push_enabled = TRUE
            ORDER BY created_at;
            """;
        command.Parameters.Add(new NpgsqlParameter<string> { TypedValue = deviceId });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var tokens = new List<string>();
        while (await reader.ReadAsync(cancellationToken))
        {
            tokens.Add(reader.GetString(0));
        }

        return tokens;
    }

    public async Task<IReadOnlyList<DeviceConnectivityUpdate>> MarkStaleDevicesOfflineAsync(
        DateTime cutoff,
        CancellationToken cancellationToken)
    {
        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            UPDATE devices
            SET connectivity_status = 'offline',
                updated_at = CURRENT_TIMESTAMP
            WHERE connectivity_status = 'online'
              AND COALESCE(last_seen_at, created_at) <= $1
            RETURNING device_id, operational_status;
            """;
        command.Parameters.Add(new NpgsqlParameter<DateTime> { TypedValue = cutoff });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var devices = new List<DeviceConnectivityUpdate>();
        while (await reader.ReadAsync(cancellationToken))
        {
            devices.Add(new DeviceConnectivityUpdate(
                reader.GetString(0),
                reader.GetString(1)));
        }

        return devices;
    }

    private static DeviceRecord ReadDevice(NpgsqlDataReader reader)
    {
        return new DeviceRecord(
            reader.GetString(0),
            GetNullableString(reader, 1),
            GetNullableString(reader, 2),
            GetNullableString(reader, 3),
            GetNullableString(reader, 4),
            reader.GetString(5),
            reader.GetString(6),
            reader.GetString(7),
            reader.GetInt32(8),
            GetNullableDateTime(reader, 9),
            reader.GetDateTime(10),
            reader.GetDateTime(11));
    }

    private static string? GetNullableString(NpgsqlDataReader reader, int ordinal)
    {
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(NpgsqlDataReader reader, int ordinal)
    {
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}

public sealed record DeviceAcknowledgeResult(
    bool Exists,
    bool Acknowledged,
    string? OperationalStatus);

public sealed record DeviceResolveResult(
    bool Exists,
    bool Resolved,
    string? OperationalStatus);

public sealed record DeviceConnectivityUpdate(
    string DeviceId,
    string OperationalStatus);

public sealed record DeviceRecord(
    string DeviceId,
    string? SerialNumber,
    string? ModelCode,
    string? HardwareRevision,
    string? FirmwareVersion,
    string LifecycleStatus,
    string ConnectivityStatus,
    string OperationalStatus,
    int BatteryPercentage,
    DateTime? LastSeenAt,
    DateTime CreatedAt,
    DateTime UpdatedAt);
