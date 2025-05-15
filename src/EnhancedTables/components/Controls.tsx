import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { EtConfiguration, EtDataColumn } from 'src/utils/types';

type FiltersConfiguration = [string, string][];

const NONE_SELECTED_SIGNAL = '---';

type ControlsViewProps = {
  columns: EtDataColumn[];
  configuration: EtConfiguration;
  filtering: string | null;
  setFiltering: Dispatch<SetStateAction<string | null>>;
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
    () =>
      [
        ...(configuration.filter ||
        Object.keys(configuration.filters ?? {}).length > 0
          ? [[NONE_SELECTED_SIGNAL, NONE_SELECTED_SIGNAL]]
          : []),
        ...(configuration.filter ? [['DEFAULT', configuration.filter]] : []),
        ...Object.entries(configuration.filters ?? {}),
      ] as FiltersConfiguration,
    [configuration.filter, configuration.filters],
  );

  const searchable = useMemo<boolean>(
    () => columns.some((c) => c.searchable),
    [columns],
  );

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
          <div>
            <select
              value={filtering ?? NONE_SELECTED_SIGNAL}
              onChange={(evt) =>
                setFiltering(
                  evt.target.value === NONE_SELECTED_SIGNAL
                    ? null
                    : evt.target.value,
                )
              }
            >
              {filters.map(([text, value]) => (
                <option key={text} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
