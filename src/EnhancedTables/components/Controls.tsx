import React, {
  Dispatch,
  SetStateAction,
  useMemo,
  useState,
} from 'react';
import { EtConfiguration, EtDataColumn } from 'src/utils/types';

const NONE_SELECTED_SIGNAL = '---';

type FiltersConfiguration = [string, string][];

type ControlsViewProps = {
  columns: EtDataColumn[];
  configuration: EtConfiguration;
  filtering: string[];
  setFiltering: Dispatch<SetStateAction<string[]>>;
  searching: string | null;
  setSearching: Dispatch<SetStateAction<string | null>>;
};

export const ControlsView: React.FC<ControlsViewProps> = ({
  columns,
  configuration,
  filtering,
  setFiltering,
  searching,
  setSearching,
}) => {
  const filters = useMemo<FiltersConfiguration>(
    () => [
      ...Object.entries(configuration.filters ?? {}),
    ],
    [configuration.filters],
  );

  const searchable = useMemo(
    () => columns.some((c) => c.searchable),
    [columns],
  );

  const handleFilterChange = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const value = evt.target.value;
    if (!filtering.includes(value)) {
      setFiltering([...filtering, value]);
    }
  };

  const handleRemoveFilter = (value: string) => {
    setFiltering(filtering.filter((f) => f !== value));
  };

  return (
    <div className="dynamic-table-controls">
      {searchable && (
        <div className="searching">
          <label>Search</label>
          <div>
            <input
              type="text"
              value={searching || ''}
              onChange={(evt) => setSearching(evt.target.value || null)}
            />
          </div>
        </div>
      )}

      {filters.length > 0 && (
        <div className="filtering">
          <label>Filter</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flexWrap: 'wrap' }}>
            <select onChange={handleFilterChange} value={NONE_SELECTED_SIGNAL}>
              <option value={NONE_SELECTED_SIGNAL} disabled>
                Select filter...
              </option>
              {filters.map(([text, value]) => (
                <option key={text} value={value}>
                  {text}
                </option>
              ))}
            </select>

            {filtering.map((f, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.2em 0.5em',
                  backgroundColor: 'var(--background-modifier-hover)',
                  border: '1px solid var(--background-modifier-border)',
                  borderRadius: '6px',
                  fontSize: '0.85em',
                  color: 'var(--text-normal)',
                }}
              >
                {filters.find(([_, val]) => val === f)?.[0] ?? f}
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(f)}
                  style={{
                    marginLeft: '0.4em',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: 'inherit',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
