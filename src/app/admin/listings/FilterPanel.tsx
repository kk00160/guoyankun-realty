"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TAINAN_DISTRICTS } from "@/lib/listings";
import {
  HOUSE_TYPES,
  type ListingQuery,
  PING_BANDS,
  PRICE_BANDS,
  ROOM_OPTIONS,
  buildListingHref
} from "@/lib/listing-filters";

/**
 * 篩選器。進頁面先看到這個，按了「搜尋」才列物件。
 *
 * 條件送出時是「換網址」而不是改 state —— 篩選在資料庫做，
 * 順便換來上一頁可用、可加書籤。
 */
export default function FilterPanel({ query, defaultOpen }: { query: ListingQuery; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  const [districts, setDistricts] = useState<string[]>(query.districts);
  const [priceBands, setPriceBands] = useState<string[]>(query.priceBands);
  const [pingBands, setPingBands] = useState<string[]>(query.pingBands);
  const [houseTypes, setHouseTypes] = useState<string[]>(query.houseTypes);
  const [rooms, setRooms] = useState<string[]>(query.rooms);
  const [minPrice, setMinPrice] = useState(query.minPrice ? String(query.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(query.maxPrice ? String(query.maxPrice) : "");
  const [keyword, setKeyword] = useState(query.keyword);

  const toggle = (value: string, current: string[], set: (next: string[]) => void) =>
    set(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  function search() {
    router.push(
      buildListingHref(query, {
        districts,
        priceBands,
        pingBands,
        houseTypes,
        rooms,
        minPrice: Number(minPrice) || null,
        maxPrice: Number(maxPrice) || null,
        keyword: keyword.trim(),
        page: 1 // 換條件一定要回第一頁，否則會停在一個不存在的分頁
      })
    );
  }

  function clear() {
    setDistricts([]);
    setPriceBands([]);
    setPingBands([]);
    setHouseTypes([]);
    setRooms([]);
    setMinPrice("");
    setMaxPrice("");
    setKeyword("");
  }

  const count =
    districts.length + priceBands.length + pingBands.length + houseTypes.length + rooms.length;

  return (
    <section className="filter-panel">
      <div className="filter-panel-head">
        <h2>篩選條件{count > 0 && <span className="filter-count">{count}</span>}</h2>
        <button type="button" className="filter-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? "收合" : "展開"}
        </button>
      </div>

      {open && (
        <div className="filter-body">
          <div className="filter-row-block">
            <div className="filter-label">位置</div>
            <div className="filter-options filter-grid">
              <button
                type="button"
                className="chip chip-any"
                data-on={districts.length === 0}
                onClick={() => setDistricts([])}
              >
                不限
              </button>
              {TAINAN_DISTRICTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  data-on={districts.includes(item)}
                  onClick={() => toggle(item, districts, setDistricts)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row-block">
            <div className="filter-label">售價</div>
            <div className="filter-options">
              <button type="button" className="chip chip-any" data-on={priceBands.length === 0 && !minPrice && !maxPrice} onClick={() => { setPriceBands([]); setMinPrice(""); setMaxPrice(""); }}>
                不限
              </button>
              {PRICE_BANDS.map((band) => (
                <button
                  key={band.key}
                  type="button"
                  className="chip"
                  data-on={priceBands.includes(band.key)}
                  onClick={() => toggle(band.key, priceBands, setPriceBands)}
                >
                  {band.label}
                </button>
              ))}
              <span className="filter-custom">
                <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" placeholder="最低" />
                <span>–</span>
                <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" placeholder="最高" />
                <span>萬</span>
              </span>
            </div>
          </div>

          <div className="filter-row-block">
            <div className="filter-label">型態</div>
            <div className="filter-options">
              <button type="button" className="chip chip-any" data-on={houseTypes.length === 0} onClick={() => setHouseTypes([])}>
                不限
              </button>
              {HOUSE_TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  data-on={houseTypes.includes(item)}
                  onClick={() => toggle(item, houseTypes, setHouseTypes)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row-block">
            <div className="filter-label">格局</div>
            <div className="filter-options">
              <button type="button" className="chip chip-any" data-on={rooms.length === 0} onClick={() => setRooms([])}>
                不限
              </button>
              {ROOM_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="chip"
                  data-on={rooms.includes(item.key)}
                  onClick={() => toggle(item.key, rooms, setRooms)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row-block">
            <div className="filter-label">權狀</div>
            <div className="filter-options">
              <button type="button" className="chip chip-any" data-on={pingBands.length === 0} onClick={() => setPingBands([])}>
                不限
              </button>
              {PING_BANDS.map((band) => (
                <button
                  key={band.key}
                  type="button"
                  className="chip"
                  data-on={pingBands.includes(band.key)}
                  onClick={() => toggle(band.key, pingBands, setPingBands)}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row-block">
            <div className="filter-label">關鍵字</div>
            <div className="filter-options">
              <input
                className="filter-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="物件名稱或路名，例：崇明路"
                maxLength={60}
              />
            </div>
          </div>

          <div className="filter-actions">
            <button type="button" className="button" onClick={search}>
              搜尋
            </button>
            <button type="button" className="button-secondary" onClick={clear}>
              清空條件
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
