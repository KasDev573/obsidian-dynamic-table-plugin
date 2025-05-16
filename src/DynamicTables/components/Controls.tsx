/**
 * ControlsView Component
 *
 * This component renders the UI controls for the dynamic table,
 * including Sort, Search, and Filter sections. It handles user
 * interactions for sorting columns, searching text within the table,
 * and applying multiple filters. The controls adapt based on the
 * configuration and columns passed in as props.
 */

import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { EtConfiguration, EtDataColumn } from 'src/utils/types';

const NONE_SELECTED_SIGNAL = '---';
const ASC = 'asc';
const DESC = 'desc';

type GroupedFiltersConfiguration = Record<string, [string, string][]>;

type ControlsViewProps = {
  columns: EtDataColumn[];
  configuration: EtConfiguration;
  filtering: string[];
  setFiltering: Dispatch<SetStateAction<string[]>>;
  sorting: string | null;
  setSorting: Dispatch<SetStateAction<string | null>>;
  searching: string | null;
  setSearching: Dispatch<SetStateAction<string | null>>;
  showSort: boolean;
  showSearch: boolean;
  showFilter: boolean;
};

export const ControlsView: React.FC<ControlsViewProps> = ({
  columns,
  configuration,
  filtering,
  setFiltering,
  sorting,
  setSorting,
  searching,
  setSearching,
  showSort,
  showSearch,
  showFilter,
}) => {
  /**
   * Memoized processing of the filters configuration from YAML,
   * grouping filters when nested objects are present.
   */
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

  /**
   * Checks if any columns are searchable to conditionally render
   * the search input.
   */
  const searchable = useMemo(
    () => columns.some((c) => c.searchable),
    [columns],
  );

  /**
   * Handles addition of a new filter value to the active filtering list.
   */
  const handleFilterChange = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const value = evt.target.value;
    if (!filtering.includes(value)) {
      setFiltering([...filtering, value]);
    }
  };

  /**
   * Handles removal of a filter value from the active filtering list.
   */
  const handleRemoveFilter = (value: string) => {
    setFiltering(filtering.filter((f) => f !== value));
  };

  // State for tracking sort order (ascending/descending)
  const [sortOrder, setSortOrder] = useState<string>(
    (sorting ?? '').startsWith('-') ? DESC : ASC
  );

  // State for the currently selected sort column/key
  const [innerSorting, setInnerSorting] = useState<string>(
    sorting ? sorting.replace(/^-/, '') : NONE_SELECTED_SIGNAL
  );

  /**
   * Effect hook to propagate sorting changes upwards based on
   * inner sorting and order states.
   */
  useEffect(() => {
    if (innerSorting === NONE_SELECTED_SIGNAL) {
      setSorting(null);
    } else {
      setSorting(`${sortOrder === DESC ? '-' : ''}${innerSorting}`);
    }
  }, [innerSorting, sortOrder, setSorting]);

  return (
    <div
      className="dynamic-table-controls"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: '1.2rem',
        marginBottom: '1rem',
      }}
    >
      {/* Conditionally render Sort Section */}
      {showSort && (
        <div className="sorting" style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '0.3em' }}>Sort</label>
          <div style={{ display: 'flex', gap: '0.5em' }}>
            <select
              value={innerSorting}
              onChange={(evt) => setInnerSorting(evt.target.value)}
              style={{
                fontSize: '1em',
                padding: '0.3em',
                minWidth: '180px',
                minHeight: '2.2em',
              }}
            >
              <option value={NONE_SELECTED_SIGNAL}>{NONE_SELECTED_SIGNAL}</option>
              {columns.map((c) => (
                <option key={c.alias} value={c.alias}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(evt) => setSortOrder(evt.target.value)}
              style={{
                fontSize: '1em',
                padding: '0.3em',
                minWidth: '100px',
                minHeight: '2.2em',
              }}
            >
              <option value={ASC}>ASC</option>
              <option value={DESC}>DESC</option>
            </select>
          </div>
        </div>
      )}

      {/* Conditionally render Search Section */}
      {showSearch && searchable && (
        <div className="searching" style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '0.3em' }}>Search</label>
          <input
            type="text"
            style={{
              fontSize: '1em',
              padding: '0.3em',
              minWidth: '200px',
              minHeight: '2.2em',
            }}
            value={searching || ''}
            onChange={(evt) => setSearching(evt.target.value || null)}
          />
        </div>
      )}

      {/* Conditionally render Filter Section */}
      {showFilter && Object.keys(filters).length > 0 && (
        <div className="filtering" style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '1.1em', fontWeight: 'bold', marginBottom: '0.3em' }}>Filter</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5em' }}>
            <select
              onChange={handleFilterChange}
              value={NONE_SELECTED_SIGNAL}
              style={{
                fontSize: '1em',
                padding: '0.3em',
                minHeight: '2.2em',
                minWidth: '180px',
              }}
            >
              <option value={NONE_SELECTED_SIGNAL} disabled></option>
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

            {/* Render active filters with a remove button */}
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
                    fontSize: '0.95em',
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
