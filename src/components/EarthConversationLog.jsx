function EarthConversationLog({ turns }) {
  if (turns.length === 0) {
    return (
      <div className="earth-conversation-log empty">
        <p>Ask about the moon, sunlight, a photo marker, or send an image/audio note.</p>
      </div>
    );
  }

  return (
    <div className="earth-conversation-log" aria-live="polite">
      {turns.map((turn) => (
        <article key={turn.id} className={`conversation-turn ${turn.status}`}>
          <div className="turn-meta">
            <span>{turn.routeLabel}</span>
            <small>{turn.createdAt}</small>
          </div>
          <div className="turn-body">
            <p className="turn-user">{turn.userText || describeAttachments(turn.attachments)}</p>
            {turn.attachments?.length > 0 && (
              <div className="turn-attachments">
                {turn.attachments.map((attachment, index) => (
                  <span key={`${attachment.name}-${index}`}>{attachment.kind}: {attachment.name}</span>
                ))}
              </div>
            )}
            <p className="turn-assistant">{turn.assistantText}</p>
            {turn.actions?.length > 0 && (
              <div className="turn-actions">
                {turn.actions.map((action, index) => (
                  <span key={`${action.type}-${index}`}>{formatAction(action)}</span>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function describeAttachments(attachments = []) {
  if (attachments.length === 0) return "Listening...";
  return `Sent ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}.`;
}

function formatAction(action) {
  if (action.type === "set_mode") return `set mode: ${action.mode}`;
  if (action.type === "focus_photo_marker") return `focus photo: ${action.id}`;
  return action.type.replaceAll("_", " ");
}

export default EarthConversationLog;
