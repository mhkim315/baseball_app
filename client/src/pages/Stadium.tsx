import { useState, useEffect, useCallback } from "react";
import { TEAM_COLORS, TEAM_LIST } from "@/lib/teamColors";
import {
  fetchStadiumBrief, fetchStadiumFoods, fetchStadiumEats, fetchStadiumSurroundings,
  type StadiumBrief, type FoodPlace, type EatsSpot, type SurroundingSpot,
} from "@/lib/api";
import { getTicketPolicy } from "@/lib/ticketPolicy";
import { MapPin, UtensilsCrossed, Car, Train, Store,
  Ticket, Users, Phone, Navigation,
} from "lucide-react";
import StadiumMap from "@/components/StadiumMap";
import { TeamBadge } from "@/components/TeamBadge";
import { config } from "@/lib/config";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorRetry } from "@/components/ErrorRetry";

const BASE = config.baseUrl;

const FOOD_MAP_IMAGES: Record<string, string> = {
  "1": "jamsil", "2": "gochuck", "3": "incheon", "4": "suwon",
  "5": "daejeon", "6": "daegu", "7": "gwangju", "8": "busan", "9": "changwon",
};

const SEAT_IMAGES: Record<string, string> = {
  "1": "jamsil", "2": "gochuck", "3": "incheon", "4": "suwon",
  "5": "daejeon", "6": "daegu", "7": "gwangju", "8": "sajik", "9": "changwon",
};

const TABS = [
  { id: "info", label: "기본정보", icon: MapPin },
  { id: "food", label: "먹거리", icon: UtensilsCrossed },
  { id: "parking", label: "주차", icon: Car },
  { id: "transport", label: "교통", icon: Train },
  { id: "nearby", label: "주변맛집", icon: Store },
];

const TEAM_STADIUM_MAP: Record<string, string> = {
  doosan: "1", lg: "1", kiwoom: "2", ssg: "3", kt: "4",
  hanwha: "5", samsung: "6", kia: "7", lotte: "8", nc: "9",
};

const FOOD_CATEGORIES: Record<string, { label: string; color: string }> = {
  chicken: { label: "치킨", color: "#dc2626" },
  korean: { label: "한·분·일", color: "#ca8a04" },
  western: { label: "양식", color: "#2563eb" },
  cafe: { label: "음료·간식", color: "#7c3aed" },
};

const CATEGORY_ORDER = ["all", "chicken", "korean", "western", "cafe"];

const DIRECTION_OFFSETS: Record<string, { dx: number; dy: number }> = {
  NW: { dx: -5.5, dy: -5.5 },
  N: { dx: 0, dy: -6.5 },
  NE: { dx: 5.5, dy: -5.5 },
  W: { dx: -6.5, dy: 0 },
  E: { dx: 6.5, dy: 0 },
  SW: { dx: -5.5, dy: 5.5 },
  S: { dx: 0, dy: 6.5 },
  SE: { dx: 5.5, dy: 5.5 },
};

const DIRECTION_TRANSFORM: Record<string, string> = {
  E: "translate(0, -50%)",
  W: "translate(-100%, -50%)",
  N: "translate(-50%, -100%)",
  S: "translate(-50%, 0)",
  NE: "translate(0, -100%)",
  NW: "translate(-100%, -100%)",
  SE: "translate(0, 0)",
  SW: "translate(-100%, 0)",
};

function detectDirection(dx: number, dy: number): string {
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return "E";
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > -22.5 && angle <= 22.5) return "E";
  if (angle > 22.5 && angle <= 67.5) return "SE";
  if (angle > 67.5 && angle <= 112.5) return "S";
  if (angle > 112.5 && angle <= 157.5) return "SW";
  if (angle > 157.5 || angle <= -157.5) return "W";
  if (angle > -157.5 && angle <= -112.5) return "NW";
  if (angle > -112.5 && angle <= -67.5) return "N";
  if (angle > -67.5 && angle <= -22.5) return "NE";
  return "E";
}

function getLabelCoords(
  store: FoodPlace,
  layouts?: Record<string, any> | null,
  stadiumId?: string,
  floor?: string,
  category?: string,
) {
  const left = store.leftPct ?? 0;
  const top = store.topPct ?? 0;

  // Look up direction from food-layouts.json via _i
  let direction = "E";
  const idx = store._i;
  if (layouts && stadiumId && idx != null) {
    const floorKey = String(floor || store.floor || "기타").trim();
    const bucket = layouts.stadiums?.[stadiumId]?.floors?.[floorKey];
    if (bucket) {
      const catKey = category && category !== "all" ? category : "all";
      const entry = bucket[catKey]?.[String(idx)] || bucket.all?.[String(idx)];
      if (entry?.labelDirection && DIRECTION_OFFSETS[entry.labelDirection]) {
        direction = entry.labelDirection;
      }
    }
  }

  // Compute uniform label position from pin + fixed offset
  const offset = DIRECTION_OFFSETS[direction] || DIRECTION_OFFSETS.E;
  const labelLeft = Math.min(100, Math.max(0, left + offset.dx));
  const labelTop = Math.min(100, Math.max(0, top + offset.dy));
  return { left, top, labelLeft, labelTop, direction };
}

function floorSort(a: string, b: string) {
  const na = parseFloat(a.replace(/[^0-9.]/g, "")) || 0;
  const nb = parseFloat(b.replace(/[^0-9.]/g, "")) || 0;
  return na === nb ? a.localeCompare(b, "ko") : na - nb;
}

function uniqueFloors(stores: FoodPlace[]): string[] {
  return Array.from(new Set(stores.map((s) => s.floor || "기타"))).sort(floorSort);
}

function categoryKey(store: FoodPlace): string {
  const raw = (store.category || "cafe").trim();
  return raw in FOOD_CATEGORIES ? raw : "cafe";
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5 leading-relaxed whitespace-pre-line">{value}</p>
      </div>
    </div>
  );
}

function ParkingCard({ spot, onClick }: { spot: SurroundingSpot; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="bg-card rounded-xl border border-border p-4 hover:bg-accent/20 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 mb-1.5">
        <Car size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold">{spot.name}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{spot.description}</p>
    </div>
  );
}

function NearbyCard({ restaurant, onClick }: { restaurant: EatsSpot; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="bg-card rounded-xl border border-border p-4 hover:bg-accent/20 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold">{restaurant.name}</span>
        <span className="text-[10px] text-muted-foreground bg-accent rounded-full px-2 py-0.5">
          {restaurant.cat}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{restaurant.address}</p>
      {restaurant.phone && (
        <div className="flex items-center gap-1 mt-1.5">
          <Phone size={10} className="text-muted-foreground" />
          <a href={`tel:${restaurant.phone}`} className="text-xs text-blue-600 hover:underline">
            {restaurant.phone}
          </a>
        </div>
      )}
    </div>
  );
}

function TransitSpotCard({ spot, onClick }: { spot: SurroundingSpot; onClick?: () => void }) {
  const Icon = spot.kind === "bus" ? Navigation : Train;
  return (
    <div onClick={onClick} className="bg-card rounded-xl border border-border p-4 hover:bg-accent/20 transition-colors cursor-pointer">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold">{spot.name}</span>
      </div>
      {spot.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{spot.description}</p>
      )}
    </div>
  );
}

export default function Stadium() {
  const [selectedTeam, setSelectedTeam] = useState("doosan");
  const [activeTab, setActiveTab] = useState("info");

  const [stadium, setStadium] = useState<StadiumBrief | null>(null);
  const [foods, setFoods] = useState<FoodPlace[]>([]);
  const [parking, setParking] = useState<SurroundingSpot[]>([]);
  const [transitSpots, setTransitSpots] = useState<SurroundingSpot[]>([]);
  const [nearby, setNearby] = useState<EatsSpot[]>([]);
  const [surroundingsCenter, setSurroundingsCenter] = useState<number[]>([127, 37.5]);
  const [surroundingsZoom, setSurroundingsZoom] = useState(14.5);
  const [eatsCenter, setEatsCenter] = useState<number[]>([127, 37.5]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [foodFloor, setFoodFloor] = useState("");
  const [foodCategory, setFoodCategory] = useState("all");
  const [selectedShop, setSelectedShop] = useState("");
  const [foodLayouts, setFoodLayouts] = useState<Record<string, any> | null>(null);
  const [focusedSpot, setFocusedSpot] = useState<string | undefined>(undefined);
  const [showTicket, setShowTicket] = useState(false);

  const load = useCallback(() => {
    const stadiumId = TEAM_STADIUM_MAP[selectedTeam];
    if (!stadiumId) return;

    setLoading(true);
    setError(false);

    Promise.all([
      fetchStadiumBrief(stadiumId),
      fetchStadiumFoods(stadiumId),
      fetchStadiumEats(stadiumId),
      fetchStadiumSurroundings(stadiumId),
      fetch(`${BASE}data/food-layouts.json`).then((r) => r.ok ? r.json() : null),
    ]).then(([brief, foodData, eatsData, surroundings, layouts]) => {
      if (brief) setStadium(brief);
      if (foodData) {
        setFoods(foodData);
        const floors = uniqueFloors(foodData);
        if (floors.length > 0 && !floors.includes(foodFloor)) setFoodFloor(floors[0]);
      }
      if (eatsData) {
        setNearby(eatsData.spots.filter((s) => s.address));
        if (eatsData.center) setEatsCenter(eatsData.center);
      }
      if (surroundings) {
        setParking(surroundings.spots.filter((s) => s.kind === "parking"));
        setTransitSpots(surroundings.spots.filter((s) => s.kind === "transit" || s.kind === "bus" || s.kind === "stadium"));
        if (surroundings.center) setSurroundingsCenter(surroundings.center);
        if (surroundings.zoom) setSurroundingsZoom(surroundings.zoom);
      }
      if (layouts) setFoodLayouts(layouts);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [selectedTeam]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setFocusedSpot(undefined);
  }, [activeTab]);

  const stadiumId = TEAM_STADIUM_MAP[selectedTeam];
  const team = TEAM_COLORS[selectedTeam];
  const foodMapImage = stadiumId ? `${BASE}food-maps/${FOOD_MAP_IMAGES[stadiumId] || "jamsil"}.webp` : null;
  const seatImage = stadiumId ? `${BASE}stadium-seats/${SEAT_IMAGES[stadiumId] || "jamsil"}.jpg` : null;

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* 모바일 헤더 */}
      <div className="md:hidden px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">구장안내</h1>
        <p className="text-sm text-muted-foreground mt-0.5">구단을 선택하면 홈구장 정보를 볼 수 있어요</p>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-2 md:mt-6">
        {/* 팀 선택 2×5 고정 그리드 */}
        <div className="grid grid-cols-5 gap-2 pb-2">
          {TEAM_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedTeam(t.id); setActiveTab("info"); }}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-all border text-center ${
                selectedTeam === t.id
                  ? "text-white border-transparent shadow-sm"
                  : "text-foreground border-border bg-card hover:bg-accent"
              }`}
              style={
                selectedTeam === t.id
                  ? { backgroundColor: t.primary, borderColor: t.primary }
                  : undefined
              }
            >
              {t.shortName}
            </button>
          ))}
        </div>

        {/* 로딩 */}
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorRetry onRetry={load} />
        ) : (
          <>
            {/* 구장 헤더 카드 */}
            {stadium && team && (
              <div className="bg-card rounded-2xl border border-border p-5 mt-3">
                <div className="flex items-center gap-3">
                  <TeamBadge teamId={selectedTeam} size="md" />
                  <div>
                    <h3 className="font-semibold text-base">{stadium.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{stadium.location} · {stadium.capacity}</p>
                    <p className="text-xs text-muted-foreground">{stadium.homeTeams}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 탭 메뉴 */}
            <div className="flex gap-1 mt-4 bg-accent/50 rounded-xl p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs transition-all ${
                      isActive
                        ? "bg-card shadow-sm font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 탭 콘텐츠 */}
            <div className="mt-3 pb-4">
              {/* 기본정보 탭 */}
              {activeTab === "info" && stadium && (
                <div className="flex flex-col gap-3">
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <InfoCard icon={Ticket} label="티켓 구매" value={`${stadium.ticket.purchase}\n${stadium.ticket.price}`} />
                    <div className="border-t border-border" />
                    <InfoCard icon={Users} label="수용인원" value={stadium.capacity} />
                    <div className="border-t border-border" />
                    <InfoCard icon={Navigation} label="위치" value={stadium.location} />
                    <div className="border-t border-border" />
                    <InfoCard icon={Car} label="주차" value={`${stadium.parking.fee}\n${stadium.parking.note}`} />
                    <div className="border-t border-border" />
                    <InfoCard icon={Train} label="대중교통" value={`${stadium.transit.subway}\n버스: ${stadium.transit.bus}`} />
                  </div>

                  {/* 좌석 배치도 */}
                  {seatImage && (
                    <div className="bg-card rounded-2xl border border-border overflow-hidden">
                      <div className="px-5 pt-4 pb-2">
                        <h3 className="text-sm font-semibold">좌석 배치도</h3>
                      </div>
                      <img
                        src={seatImage}
                        alt="좌석 배치도"
                        className="w-full h-auto"
                        draggable={false}
                      />
                    </div>
                  )}

                  {/* 예매 정보 */}
                  {(() => {
                    const tp = getTicketPolicy(selectedTeam);
                    if (!tp) return null;
                    return (
                      <div className="bg-card rounded-2xl border border-border p-5">
                        <button
                          onClick={() => setShowTicket(!showTicket)}
                          className="flex items-center justify-between w-full text-left"
                        >
                          <h3 className="text-sm font-semibold">예매 정보</h3>
                          <span className="text-xs text-muted-foreground">{showTicket ? "접기" : "펼치기"}</span>
                        </button>
                        {showTicket && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-2">예매: {tp.platform}</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border">
                                    <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">등급</th>
                                    <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">예매</th>
                                    <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">시간</th>
                                    <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground">최대</th>
                                    <th className="text-left py-1.5 font-medium text-muted-foreground">좌석</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tp.tiers.map((tier) => (
                                    <tr key={tier.id} className="border-b border-border/50 last:border-0">
                                      <td className="py-1.5 pr-2">{tier.name}</td>
                                      <td className="py-1.5 pr-2">{tier.dDay === null ? "고정좌석" : tier.dDay < 0 ? `D${tier.dDay}` : `D-${tier.dDay}`}</td>
                                      <td className="py-1.5 pr-2">{tier.time || "—"}</td>
                                      <td className="py-1.5 pr-2">{tier.maxTickets != null ? `${tier.maxTickets}매` : "—"}</td>
                                      <td className="py-1.5">{tier.seats}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 먹거리 탭 */}
              {activeTab === "food" && (
                <div className="flex flex-col gap-2">
                  {foods.length > 0 ? (
                    <>
                      {/* Floor filter tabs */}
                      {(() => {
                        const floors = uniqueFloors(foods);
                        const currentFloor = floors.includes(foodFloor) ? foodFloor : floors[0] || "";
                        const filteredByFloor = foods.filter((s) => (s.floor || "기타") === currentFloor);
                        const presentCats = new Set(filteredByFloor.map(categoryKey));
                        const cats = CATEGORY_ORDER.filter((id) => id === "all" || presentCats.has(id));
                        const currentCat = cats.includes(foodCategory) ? foodCategory : "all";

                        // Filter stores
                        const visibleStores = currentCat === "all"
                          ? filteredByFloor
                          : filteredByFloor.filter((s) => categoryKey(s) === currentCat);

                        return (
                          <>
                            {/* Floor tabs */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                              {floors.map((f) => (
                                <button
                                  key={f}
                                  onClick={() => { setFoodFloor(f); setFoodCategory("all"); setSelectedShop(""); }}
                                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border bg-card ${
                                    f === currentFloor
                                      ? "text-foreground font-semibold"
                                      : "text-muted-foreground border-border hover:bg-accent"
                                  }`}
                                  style={f === currentFloor ? { border: `2px solid ${team?.primary || "#000"}` } : undefined}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>

                            {/* Category tabs */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                              {cats.map((cat) => {
                                const catInfo = cat === "all" ? { label: "전체", color: "" } : FOOD_CATEGORIES[cat];
                                const isActive = cat === currentCat;
                                return (
                                  <button
                                    key={cat}
                                    onClick={() => { setFoodCategory(cat); setSelectedShop(""); }}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                      isActive
                                        ? "text-white border-transparent shadow-sm"
                                        : "text-muted-foreground border-border bg-card hover:bg-accent"
                                    }`}
                                    style={isActive ? { backgroundColor: catInfo?.color || "#222" } : undefined}
                                  >
                                    {catInfo?.label || cat}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Food map */}
                            {foodMapImage && visibleStores.length > 0 && (
                              <div className="bg-card rounded-2xl border border-border p-2 overflow-auto">
                                <div className="relative inline-block max-w-full" style={{ minWidth: "100%" }}>
                                  <img
                                    src={foodMapImage}
                                    alt="먹거리 지도"
                                    className="block w-full h-auto rounded-xl"
                                    draggable={false}
                                  />
                                  {/* SVG connector lines */}
                                  <svg
                                    className="absolute inset-0 pointer-events-none z-10"
                                    style={{ width: "100%", height: "100%" }}
                                    aria-hidden="true"
                                  >
                                    {visibleStores.map((food, i) => {
                                      if (food.leftPct == null || food.topPct == null) return null;
                                      const coords = getLabelCoords(food, foodLayouts, stadiumId, currentFloor, currentCat);
                                      return (
                                        <line
                                          key={i}
                                          x1={`${coords.left}%`}
                                          y1={`${coords.top}%`}
                                          x2={`${coords.labelLeft}%`}
                                          y2={`${coords.labelTop}%`}
                                          stroke={FOOD_CATEGORIES[categoryKey(food)]?.color || "#6b7280"}
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                        />
                                      );
                                    })}
                                  </svg>
                                  {/* Pin markers + labels */}
                                  {visibleStores.map((food, i) => {
                                    if (food.leftPct == null || food.topPct == null) return null;
                                    const coords = getLabelCoords(food, foodLayouts, stadiumId, currentFloor, currentCat);
                                    const isSelected = selectedShop === food.shop;
                                    const catColor = FOOD_CATEGORIES[categoryKey(food)]?.color || "#6b7280";
                                    const labelTransform = DIRECTION_TRANSFORM[coords.direction] || "translate(0, -50%)";

                                    return (
                                      <div key={i}>
                                        {/* Pin dot */}
                                        <button
                                          onClick={() => setSelectedShop(selectedShop === food.shop ? "" : food.shop)}
                                          className="absolute w-2.5 h-2.5 rounded-full border-[1.5px] border-white shadow-md hover:scale-125 transition-transform z-20"
                                          style={{
                                            left: `${coords.left}%`,
                                            top: `${coords.top}%`,
                                            backgroundColor: catColor,
                                            transform: "translate(-50%, -50%)",
                                          }}
                                          title={food.shop}
                                        />
                                        {/* Label */}
                                        <button
                                          onClick={() => setSelectedShop(selectedShop === food.shop ? "" : food.shop)}
                                          className="absolute text-[9px] font-medium whitespace-nowrap leading-tight px-1 py-[1px] rounded-sm transition-colors z-20"
                                          style={{
                                            left: `${coords.labelLeft}%`,
                                            top: `${coords.labelTop}%`,
                                            transform: labelTransform,
                                            backgroundColor: isSelected ? catColor : "rgba(255,255,255,0.92)",
                                            color: isSelected ? "#fff" : "#222",
                                            border: isSelected ? `1.5px solid ${catColor}` : "1px solid rgba(0,0,0,0.15)",
                                            boxShadow: isSelected ? `0 1px 4px ${catColor}40` : "0 1px 2px rgba(0,0,0,0.08)",
                                          }}
                                        >
                                          {food.shop}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Selected shop detail */}
                            {selectedShop && (() => {
                              const shopStores = visibleStores.filter((s) => s.shop === selectedShop);
                              if (!shopStores.length) return null;
                              const store = shopStores[0];
                              const cat = categoryKey(store);
                              const catLabel = FOOD_CATEGORIES[cat]?.label || cat;
                              const menus = Array.from(new Set(shopStores.map((s) => s.menu).filter(Boolean))).join(" / ");
                              return (
                                <div className="bg-card rounded-2xl border border-border p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold">{selectedShop}</h4>
                                    <span
                                      className="text-[10px] text-white font-medium px-2 py-0.5 rounded-full"
                                      style={{ backgroundColor: FOOD_CATEGORIES[cat]?.color || "#6b7280" }}
                                    >
                                      {catLabel}
                                    </span>
                                  </div>
                                  {menus && <p className="text-xs text-muted-foreground mb-2">{menus}</p>}
                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    {shopStores.map((s, i) => (
                                      <p key={i}>{s.floor} · {s.zone}{s.standZone ? ` · ${s.standZone}` : ""}</p>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Food list (chip-style) */}
                            <div className="flex flex-wrap gap-1.5">
                              {visibleStores.length > 0 ? (
                                (() => {
                                  const seen = new Set<string>();
                                  return visibleStores.map((store) => {
                                    if (seen.has(store.shop)) return null;
                                    seen.add(store.shop);
                                    const cat = categoryKey(store);
                                    const catColor = FOOD_CATEGORIES[cat]?.color || "#6b7280";
                                    const isActive = selectedShop === store.shop;
                                    return (
                                      <button
                                        key={store.shop}
                                        onClick={() => setSelectedShop(selectedShop === store.shop ? "" : store.shop)}
                                        className="flex items-center gap-1.5 text-xs font-medium transition-all border rounded-md px-2.5 py-1.5 bg-card"
                                        style={{
                                          borderColor: isActive ? catColor : "var(--border)",
                                          color: isActive ? catColor : "var(--foreground)",
                                          boxShadow: isActive ? `0 0 0 1px ${catColor}40` : "none",
                                        }}
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: catColor }}
                                        />
                                        {store.shop}
                                      </button>
                                    );
                                  });
                                })()
                              ) : (
                                <div className="w-full bg-card rounded-2xl border border-border p-8 text-center">
                                  <p className="text-muted-foreground text-sm">해당 조건에 맞는 매장이 없어요</p>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center">
                      <p className="text-muted-foreground text-sm">아직 먹거리 정보가 없어요</p>
                    </div>
                  )}
                </div>
              )}

              {/* 주차 탭 */}
              {activeTab === "parking" && (
                <div className="flex flex-col gap-2">
                  {stadium && (
                    <div className="bg-card rounded-2xl border border-border p-4 mb-1">
                      <p className="text-sm font-medium">{stadium.parking.fee}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stadium.parking.note}</p>
                    </div>
                  )}
                  {parking.length > 0 && (
                    <StadiumMap
                      spots={parking.map((s) => ({ ...s, kind: "parking" }))}
                      center={surroundingsCenter}
                      zoom={surroundingsZoom}
                      focusedSpotId={focusedSpot}
                      onPinClick={(spotId) => setFocusedSpot(spotId)}
                    />
                  )}
                  {parking.length > 0 ? (
                    parking.map((spot, i) => <ParkingCard key={i} spot={spot} onClick={() => setFocusedSpot(spot.id || String(i))} />)
                  ) : (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center">
                      <p className="text-muted-foreground text-sm">아직 주차 정보가 없어요</p>
                    </div>
                  )}
                </div>
              )}

              {/* 교통 탭 */}
              {activeTab === "transport" && stadium && (
                <div className="flex flex-col gap-2">
                  {transitSpots.length > 0 && (
                    <StadiumMap
                      spots={transitSpots}
                      center={surroundingsCenter}
                      zoom={surroundingsZoom}
                      focusedSpotId={focusedSpot}
                      onPinClick={(spotId) => setFocusedSpot(spotId)}
                    />
                  )}
                  {transitSpots.length > 0 ? (
                    transitSpots.map((spot, i) => (
                      <TransitSpotCard key={i} spot={spot} onClick={() => setFocusedSpot(spot.id || String(i))} />
                    ))
                  ) : (
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <InfoCard icon={Train} label="지하철" value={stadium.transit.subway} />
                      <div className="border-t border-border" />
                      <InfoCard icon={Navigation} label="버스" value={stadium.transit.bus} />
                    </div>
                  )}
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <InfoCard icon={Car} label="주차 안내" value={`${stadium.parking.fee}\n${stadium.parking.note}`} />
                  </div>
                </div>
              )}

              {/* 주변맛집 탭 */}
              {activeTab === "nearby" && (
                <div className="flex flex-col gap-2">
                  {nearby.length > 0 && (
                    <StadiumMap
                      spots={nearby.map((r, i) => ({ id: String(i), lng: r.lng, lat: r.lat, name: r.name, description: `${r.cat} · ${r.address}`, kind: "parking" }))}
                      center={eatsCenter}
                      zoom={14}
                      focusedSpotId={focusedSpot}
                      onPinClick={(spotId) => setFocusedSpot(spotId)}
                    />
                  )}
                  {nearby.length > 0 ? (
                    nearby.map((r, i) => <NearbyCard key={i} restaurant={r} onClick={() => setFocusedSpot(String(i))} />)
                  ) : (
                    <div className="bg-card rounded-2xl border border-border p-8 text-center">
                      <p className="text-muted-foreground text-sm">아직 주변 맛집 정보가 없어요</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
