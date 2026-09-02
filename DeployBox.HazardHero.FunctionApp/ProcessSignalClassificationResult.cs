using Azure.Messaging.ServiceBus;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace DeployBox.HazardHero.FunctionApp;

public class ProcessSignalClassificationResult
{
    private readonly ILogger<ProcessSignalClassificationResult> _logger;
    private readonly SignalClassificationResultRepository _repository;
    private readonly IDeviceNotificationService _notificationService;

    public ProcessSignalClassificationResult(
        ILogger<ProcessSignalClassificationResult> logger,
        SignalClassificationResultRepository repository,
        IDeviceNotificationService notificationService)
    {
        _logger = logger;
        _repository = repository;
        _notificationService = notificationService;
    }

    [Function("ProcessSignalClassificationResult")]
    public async Task Run(
        [ServiceBusTrigger(
            "sbq-signal-classification-results",
            Connection = "ServiceBusConnection",
            AutoCompleteMessages = false)]
        ServiceBusReceivedMessage message,
        ServiceBusMessageActions messageActions,
        CancellationToken cancellationToken)
    {
        var body = message.Body.ToString();

        if (!SignalClassificationResultValidator.TryParse(body, out var result, out var error))
        {
            _logger.LogWarning(
                "Dead-lettering invalid signal classification result {MessageId}: {Reason}",
                message.MessageId,
                error);

            await messageActions.DeadLetterMessageAsync(
                message,
                new Dictionary<string, object>
                {
                    ["DeadLetterReason"] = "InvalidSignalClassificationResult",
                    ["DeadLetterErrorDescription"] = error
                },
                cancellationToken: cancellationToken);
            return;
        }

        var inserted = await _repository.PersistAndUpdateDeviceAsync(
            result!,
            body,
            cancellationToken);

        _logger.LogInformation(
            inserted
                ? "Persisted signal classification result {MessageId}."
                : "Signal classification result {MessageId} was already persisted.",
            result!.MessageId);

        if (result.Classification!.Label == "positive")
        {
            await _notificationService.SendAsync(
                new DeviceNotification(
                    result.DeviceId!,
                    "assistance_requested",
                    "Assistance requested",
                    "A device has requested assistance.",
                    new Dictionary<string, string>
                    {
                        ["messageId"] = result.MessageId!
                    }),
                cancellationToken);
        }

        await messageActions.CompleteMessageAsync(message, cancellationToken);
    }
}
