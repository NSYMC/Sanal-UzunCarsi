import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGoldPrice, PRODUCT_PROFILES } from '../src/gold-pricing.js';

test('külçe fiyatına yalnızca altın değeri ve külçe mağaza payı eklenir', () => {
    const result = calculateGoldPrice(6000, PRODUCT_PROFILES.MAWUS_HQ_GRAM_ALTIN);
    assert.equal(result.pureGoldValue, 6000);
    assert.equal(result.workmanship, 0);
    assert.equal(result.serviceFee, 0);
    assert.equal(result.margin, 150);
    assert.equal(result.total, 6150);
});

test('14 ayar yüzük hesabı saflık, tahmini ağırlık ve işçiliği uygular', () => {
    const result = calculateGoldPrice(6000, PRODUCT_PROFILES.MAWUS_HQ_ALTIN_YUZUK);
    assert.ok(Math.abs(result.pureGoldValue - 14700) < 0.001);
    assert.equal(result.workmanship, 1785);
    assert.ok(Math.abs(result.margin - 882) < 0.001);
    assert.ok(Math.abs(result.total - 17367) < 0.001);
});

test('taşlı üründe taş değeri yerine yalnızca tanımlı montür hizmeti eklenir', () => {
    const result = calculateGoldPrice(6000, PRODUCT_PROFILES.MAWUS_HQ_ALTIN_YUZUK_TASLI);
    assert.equal(result.serviceFee, 1750);
    assert.equal(result.total, 21598);
});

test('çeyrek, yarım ve tam altın aynı fiyat profiline paylaşılmaz', () => {
    const spot = 6000;
    const quarter = calculateGoldPrice(spot, PRODUCT_PROFILES.MAWUS_HQ_CEYREK_ALTIN).total;
    const half = calculateGoldPrice(spot, PRODUCT_PROFILES.MAWUS_HQ_YARIM_ALTIN).total;
    const full = calculateGoldPrice(spot, PRODUCT_PROFILES.MAWUS_HQ_TAM_ALTIN).total;
    const republic = calculateGoldPrice(spot, PRODUCT_PROFILES.MAWUS_CUMHURIYET_ALTINI).total;
    assert.ok(quarter < half);
    assert.ok(half < full);
    assert.ok(full < republic);
});
