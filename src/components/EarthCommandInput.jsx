import { Mic, Send } from "lucide-react";
import { useState } from "react";

function EarthCommandInput({ response, onSubmit }) {
  const [value, setValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const command = value.trim();
    if (!command) return;
    onSubmit(command);
    setValue("");
  }

  return (
    <div className="earth-command">
      <form className="earth-command-form" onSubmit={handleSubmit}>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask the Earth..."
          aria-label="Ask the Earth"
        />
        <button type="button" aria-label="Voice command placeholder" title="Voice command placeholder">
          <Mic size={15} />
        </button>
        <button type="submit" aria-label="Send Earth command" title="Send Earth command">
          <Send size={15} />
        </button>
      </form>
      {response && <p className="earth-command-response">{response}</p>}
    </div>
  );
}

export default EarthCommandInput;
