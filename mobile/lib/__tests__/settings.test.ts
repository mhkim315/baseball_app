import {
  getStadiumCoachSeen, setStadiumCoachSeen,
  getMyCoachSeen, setMyCoachSeen,
} from "@/lib/db/settings";

// Each test suite gets a fresh DB via module isolation, but the mock
// stores tables globally. Reset by re-requiring expo-sqlite.
beforeEach(async () => {
  const db = await require("expo-sqlite").openDatabaseAsync();
  await db.execAsync("DELETE FROM user_settings");
});

describe("스타디움 코치마크", () => {
  it("초기에는 false 반환", async () => {
    expect(await getStadiumCoachSeen()).toBe(false);
  });

  it("set 후에는 true 반환", async () => {
    await setStadiumCoachSeen();
    expect(await getStadiumCoachSeen()).toBe(true);
  });

  it("여러 번 호출해도 안전", async () => {
    await setStadiumCoachSeen();
    await setStadiumCoachSeen();
    expect(await getStadiumCoachSeen()).toBe(true);
  });
});

describe("MY 탭 코치마크", () => {
  it("초기에는 false 반환", async () => {
    expect(await getMyCoachSeen()).toBe(false);
  });

  it("set 후에는 true 반환", async () => {
    await setMyCoachSeen();
    expect(await getMyCoachSeen()).toBe(true);
  });
});
