import { describe, expect, it } from "vitest";
import { screenMessage, violatesFloor } from "./screen";

const level = (text: string) => screenMessage(text).level;

describe("message screening", () => {
  it("treats thoughts of self-harm as a crisis", () => {
    expect(level("honestly i want to die")).toBe("crisis");
    expect(level("I've been thinking about killing myself")).toBe("crisis");
    expect(level("sometimes I hurt myself when I overeat")).toBe("crisis");
  });

  it("flags purging and compensatory behaviour strongly", () => {
    expect(level("I make myself throw up after dinner")).toBe("strong");
    expect(level("should I take laxatives to lose weight")).toBe("strong");
    expect(level("I purged again last night")).toBe("strong");
    expect(level("I need to burn off everything I ate")).toBe("strong");
    expect(level("thinking about a 72 hour fast")).toBe("strong");
    expect(level("I've been starving myself all week")).toBe("strong");
  });

  it("flags requests to eat an unsafe amount", () => {
    expect(screenMessage("can I eat 500 calories a day").signals).toContain("extreme_intake");
    expect(level("I want to stick to 600 kcal")).toBe("strong");
    expect(level("is 900 calories a day ok")).toBe("soft");
  });

  it("handles food guilt and body distress gently, without the strongest response", () => {
    expect(level("I feel so guilty after eating pizza")).toBe("soft");
    expect(level("I binged last night")).toBe("soft");
    expect(level("I hate my body")).toBe("soft");
    expect(level("what is the quickest way to lose 10 lbs in a week")).toBe("soft");
  });

  it("leaves ordinary questions alone", () => {
    for (const text of [
      "Review my week",
      "Why has my weight stalled?",
      "Plan tomorrow's meals",
      "Is my training volume right?",
      "How much protein is in 200 calories of chicken?",
      "That snack was 150 calories, is that fine?",
      "I want a 300 calorie deficit",
      "How do I get better at pull-ups?",
      "I ate a 600 calorie lunch today",
    ]) {
      expect(level(text), text).toBe("none");
    }
  });
});

describe("output floor check", () => {
  it("catches a reply that recommends eating below the floor", () => {
    expect(violatesFloor("You could aim for 900 calories a day to speed things up.", 1200)).toBe(true);
    expect(violatesFloor("Try eating around 1,000 kcal.", 1200)).toBe(true);
    expect(violatesFloor("Cut to 1000 kcal for a week.", 1200)).toBe(true);
  });
  it("does not fire on differences or on the size of one meal", () => {
    expect(violatesFloor("You're eating about 340 kcal a day more than your 2100 kcal target.", 1500)).toBe(false);
    expect(violatesFloor("Try eating 300 calories less on rest days.", 1500)).toBe(false);
    expect(violatesFloor("Eat a 400 calorie snack after training.", 1500)).toBe(false);
    expect(violatesFloor("Aim for a 500 kcal breakfast with 35 g protein.", 1500)).toBe(false);
    expect(violatesFloor("Aim for 1200 kcal a day.", 1500)).toBe(true);
  });

  it("does not fire on ordinary numbers", () => {
    expect(violatesFloor("Your target is 2,050 kcal and you averaged 2,114.", 1200)).toBe(false);
    expect(violatesFloor("A 400 calorie snack with 30 g protein would close the gap.", 1200)).toBe(false);
    expect(violatesFloor("Aim for 2200 calories.", 1200)).toBe(false);
  });
});
