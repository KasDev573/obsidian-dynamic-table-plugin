/**
 * PaginationView Component
 *
 * This component provides a user interface for paginating through
 * a large set of data items. It displays pagination controls such
 * as page numbers, next/previous buttons, first/last buttons, and
 * a selector for page size. It dynamically calculates the page range
 * to display based on the current page and total items.
 *
 * Props:
 * - value: Current pagination state (pageNumber and pageSize).
 * - onChange: Callback invoked when the page number or page size changes.
 * - pageSizeOptions: List of selectable page sizes for the user.
 * - totalNumberOfItems: Total count of items available to paginate.
 */

 /**
  * When to use this component:
  *
  * Use PaginationView to provide UI for navigating through paged data sets.
  * It is designed to work with a controlled pagination state passed in via props,
  * and it emits changes back to the parent through onChange.
  *
  * This component is useful when dealing with large tables or lists where showing
  * all items at once is impractical, allowing users to select pages and page sizes.
  */

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type PaginationOptions = {
  pageSize: number;
  pageNumber: number;
};

export type PaginationViewProps = {
  value: PaginationOptions;
  onChange: (val: PaginationOptions) => void;

  pageSizeOptions: number[];

  totalNumberOfItems: number;
};

export const DEFAULT_MAX_BUTTONS = 3;

export const PaginationView: React.FC<PaginationViewProps> = ({
  pageSizeOptions,

  value,
  onChange,

  totalNumberOfItems,
}) => {
  // Local state to track current page number and page size internally
  const [pageNumber, setPageNumber] = useState<number>(value.pageNumber);
  const [pageSize, setPageSize] = useState<number>(value.pageSize);

  // Local state for total number of pages (based on total items and page size)
  const [totalNumberOfPages, setTotalNumberOfPages] = useState<number>(
    Math.ceil(totalNumberOfItems / pageSize),
  );

  /**
   * Memoized calculation of the array of page numbers to display.
   * It shows up to DEFAULT_MAX_BUTTONS pages centered around the current page.
   * Includes logic to show ellipses when pages are skipped.
   */
  const pages = useMemo<number[]>(() => {
    const numberOfPages = Math.ceil(totalNumberOfItems / pageSize);
    setTotalNumberOfPages(numberOfPages);

    if (numberOfPages <= DEFAULT_MAX_BUTTONS) {
      return Array.from({ length: numberOfPages }, (_, idx) => idx + 1);
    }

    const firstPageBeforeTheCurrentOne = Math.max(
      1,
      Math.min(
        pageNumber - Math.floor(DEFAULT_MAX_BUTTONS / 2),
        numberOfPages - DEFAULT_MAX_BUTTONS + 1,
      ),
    );
    const pagesBeforeTheCurrentOne = Array.from(
      { length: pageNumber - firstPageBeforeTheCurrentOne },
      (_, idx) => firstPageBeforeTheCurrentOne + idx,
    );

    const lastPageAfterTheCurrentOne = Math.min(
      numberOfPages,
      Math.max(
        pageNumber + Math.floor(DEFAULT_MAX_BUTTONS / 2),
        DEFAULT_MAX_BUTTONS,
      ),
    );
    const pagesAfterTheCurrentOne = Array.from(
      { length: lastPageAfterTheCurrentOne - pageNumber },
      (_, idx) => pageNumber + idx + 1,
    );

    return [
      ...pagesBeforeTheCurrentOne,
      pageNumber,
      ...pagesAfterTheCurrentOne,
    ];
  }, [pageSize, pageNumber, totalNumberOfItems]);

  /**
   * Handler to change the current page.
   * Updates internal state and calls the onChange prop.
   */
  const changePage = useCallback(
    (pageNumber: number) => {
      setPageNumber(pageNumber);
      if (onChange) {
        onChange({ pageSize, pageNumber });
      }
    },
    [onChange, pageSize],
  );

  /**
   * Effect to update internal state if the external pagination value changes.
   * Ensures the component reflects external updates correctly.
   */
  useEffect(() => {
    if (value) {
      if (value.pageNumber) {
        setPageNumber(value.pageNumber);
      }

      if (value.pageSize) {
        setPageSize(value.pageSize);
      }
    }
  }, [value]);

  return (
    <Fragment>
      <div className="dynamic-table-pagination">
        <div className="d-flex flex-wrap py-2 mr-3 ">
          {/* Only show pagination controls if total items exceed the page size */}
          {totalNumberOfItems > pageSize && (
            <Fragment>
              {/* First page button */}
              <button
                disabled={pageNumber === 1}
                onClick={() => changePage(1)}
                className="pag-nav-first"
              >
                &lt;&lt;
              </button>

              {/* Previous page button */}
              <button
                className="pag-nav-prev"
                disabled={pageNumber === 1}
                onClick={() => changePage(pageNumber - 1)}
              >
                &lt;
              </button>

              {/* Ellipsis if pages before the first visible page are skipped */}
              {pages[0] !== 1 && (
                <button
                  disabled
                  style={{ backgroundColor: 'transparent' }}
                  className="pag-nav-dots"
                >
                  ...
                </button>
              )}

              {/* Buttons for individual pages */}
              {pages.map((page) => (
                <button
                  className={`${page === pageNumber ? 'active' : undefined} pag-nav-page`}
                  key={page}
                  onClick={() => changePage(page)}
                >
                  {page}
                </button>
              ))}

              {/* Ellipsis if pages after the last visible page are skipped */}
              {pages[pages.length - 1] !== totalNumberOfPages && (
                <button
                  className="pag-nav-dots"
                  disabled
                  style={{ backgroundColor: 'transparent', color: '#7e8299' }}
                >
                  ...
                </button>
              )}

              {/* Next page button */}
              <button
                className="pag-nav-next"
                disabled={pageNumber === totalNumberOfPages}
                onClick={() => changePage(pageNumber + 1)}
              >
                &gt;
              </button>

              {/* Last page button */}
              <button
                className="pag-nav-last"
                disabled={pageNumber === totalNumberOfPages}
                onClick={() => changePage(totalNumberOfPages)}
              >
                &gt;&gt;
              </button>
            </Fragment>
          )}

          {/* Total number of items display */}
          <div className="total">
            <div>Total: {totalNumberOfItems}</div>
          </div>
        </div>

        {/* Page size selection dropdown */}
        <div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              onChange({ pageSize: Number(e.target.value), pageNumber });
            }}
          >
            {pageSizeOptions.map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Fragment>
  );
};
