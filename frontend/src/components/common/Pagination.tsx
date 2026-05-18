import React, { useMemo } from "react";

type Props = {
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const Pagination: React.FC<Props> = ({
  page,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSize = true,
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const pages = useMemo(() => {
    const windowSize = 5;
    let start = Math.max(1, safePage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);

    if (end - start + 1 < windowSize) {
      start = Math.max(1, end - windowSize + 1);
    }

    const values: number[] = [];
    for (let i = start; i <= end; i += 1) {
      values.push(i);
    }
    return values;
  }, [safePage, totalPages]);

  return (
    <div className="ui-pagination">
      <div className="ui-pagination__meta">
        <p className="small">
          Showing {startItem}-{endItem} of {totalItems}
        </p>

        {showPageSize && (
          <div className="ui-pagination__size">
            <label className="small" htmlFor="pagination-page-size">
              Rows
            </label>
            <select
              id="pagination-page-size"
              className="input"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((value) => (
                <option key={value} value={value}>
                  {value} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="ui-pagination__controls">
        <button
          type="button"
          className="ui-btn ui-btn--soft ui-btn--small"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
        >
          First
        </button>

        <button
          type="button"
          className="ui-btn ui-btn--soft ui-btn--small"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          Prev
        </button>

        <div className="ui-pagination__pages">
          {pages.map((value) => (
            <button
              key={value}
              type="button"
              className={`ui-btn ui-btn--small ${
                value === safePage ? "ui-btn--primary" : "ui-btn--soft"
              }`}
              onClick={() => onPageChange(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="ui-btn ui-btn--soft ui-btn--small"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
        >
          Next
        </button>

        <button
          type="button"
          className="ui-btn ui-btn--soft ui-btn--small"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
        >
          Last
        </button>
      </div>
    </div>
  );
};

export default Pagination;