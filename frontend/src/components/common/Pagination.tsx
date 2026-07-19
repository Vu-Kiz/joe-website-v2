import React, { useMemo } from "react";
import { INPUT } from '../../utils/ui';

type Props = {
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  showPageSize?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const paginationButtonBaseClass =
  "inline-flex min-h-[34px] items-center justify-center rounded-[10px] border px-[0.8rem] py-2 text-[0.88rem] font-bold leading-none no-underline transition-[border-color,background,transform,box-shadow] duration-150 ease-out hover:enabled:-translate-y-px hover:enabled:border-[#f5d546]/[0.28] hover:enabled:bg-[#f5d546]/[0.07] disabled:cursor-not-allowed disabled:opacity-[0.55] font-tektur";
const paginationButtonSoftClass = "border-white/10 bg-white/[0.025] text-white/90";
const paginationButtonPrimaryClass =
  "border-[#f5d546]/35 bg-[#f5d546]/10 text-[#f2c46f] shadow-[inset_0_0_0_1px_rgba(245,213,70,0.08)] hover:enabled:border-[#f5d546]/45 hover:enabled:bg-[#f5d546]/15";

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
    const end = Math.min(totalPages, start + windowSize - 1);

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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <p className="small">
          Showing {startItem}-{endItem} of {totalItems}
        </p>

        {showPageSize && (
          <div className="flex items-center gap-2">
            <label className="small" htmlFor="pagination-page-size">
              Rows
            </label>
            <select
              id="pagination-page-size"
              className={INPUT + " min-w-[120px] w-auto"}
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${paginationButtonBaseClass} ${paginationButtonSoftClass}`}
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
        >
          First
        </button>

        <button
          type="button"
          className={`${paginationButtonBaseClass} ${paginationButtonSoftClass}`}
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          Prev
        </button>

        <div className="flex flex-wrap items-center gap-[0.35rem]">
          {pages.map((value) => (
            <button
              key={value}
              type="button"
              className={`${paginationButtonBaseClass} ${
                value === safePage ? paginationButtonPrimaryClass : paginationButtonSoftClass
              }`}
              onClick={() => onPageChange(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`${paginationButtonBaseClass} ${paginationButtonSoftClass}`}
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
        >
          Next
        </button>

        <button
          type="button"
          className={`${paginationButtonBaseClass} ${paginationButtonSoftClass}`}
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
