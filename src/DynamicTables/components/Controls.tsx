import React, {
  Dispatch,
  SetStateAction,
  useMemo,
} from 'react';
import { EtConfiguration, EtDataColumn } from 'src/utils/types';

const NONE_SELECTED_SIGNAL = '---';

type GroupedFiltersConfiguration = Record<
  string,
  [string, string][]
>;

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
  const filters = useMemo<GroupedFiltersConfiguration>(() => {
    const raw = configuration.filters ?? {};
    const result: GroupedFiltersConfiguration = {};

    for (const [groupOrLabel, value] of Object.entries(raw)) {
      if (typeof value === 'object' && value !== null) {
        result[groupOrLabel] = Object.entries(value as Record<string, string>);
      } else {
        if (!result['Filters']) result['Filters'] = [];
        result['Filters'].push([groupOrLabel, value as string]);
      }
    }

    return result;
  }, [configuration.filters]);

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
          <label style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Search</label>
          <div>
            <input
              type="text"
              style={{ fontSize: '1.1em', padding: '0.4em' }}
              value={searching || ''}
              onChange={(evt) => setSearching(evt.target.value || null)}
            />
          </div>
        </div>
      )}

      {Object.keys(filters).length > 0 && (
        <div className="filtering">
          <label style={{ fontSize: '1.2em', fontWeight: 'bold' }}>Filter</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flexWrap: 'wrap' }}>
            <select
              onChange={handleFilterChange}
              value={NONE_SELECTED_SIGNAL}
              style={{ fontSize: '1.1em', padding: '0.4em' }}
            >
              <option value={NONE_SELECTED_SIGNAL} disabled>

              </option>

              {Object.entries(filters).map(([group, options]) => (
                <optgroup key={group} label={group}>
                  {options.map(([label, value]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {filtering.map((f, idx) => {
              const label =
                Object.values(filters)
                  .flat()
                  .find(([, val]) => val === f)?.[0] ?? f;

              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.2em 0.5em',
                    backgroundColor: 'var(--background-modifier-hover)',
                    border: '1px solid var(--background-modifier-border)',
                    borderRadius: '6px',
                    fontSize: '1.05em',
                    color: 'var(--text-normal)',
                  }}
                >
                  {label}
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
