import assert from "node:assert/strict";
import test from "node:test";
import { serviceBody, updateServiceBody } from "./service-validation";

const validService = {
  name: "Massage",
  category: "Massage",
  shortDescription: "A calming treatment",
  description: "A longer treatment description",
  durationMinutes: 60,
  priceAmount: 5000,
  currency: "NGN",
  isFeatured: false,
};

test("service creation accepts a blank optional image URL", () => {
  const parsed = serviceBody.safeParse({ ...validService, imageUrl: "" });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.imageUrl, null);
});

test("service edits accept a blank optional image URL", () => {
  const parsed = updateServiceBody.safeParse({ imageUrl: "" });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.imageUrl, null);
});
