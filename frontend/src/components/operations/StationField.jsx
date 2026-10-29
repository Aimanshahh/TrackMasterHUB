import { useId } from 'react';

/** Station input with suggestions taken from stations already recorded. */
export default function StationField({ label = 'Station / location', value, onChange, stations = [], required = false, hint }) {
  const listId = useId();

  return (
    <label className="field">
      <span className="field__label">{label}{required ? <i>Required</i> : null}</span>
      <input
        className="input"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Select or type a station"
        autoComplete="off"
        required={required}
      />
      <datalist id={listId}>
        {stations.map((station) => <option key={station} value={station} />)}
      </datalist>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}
