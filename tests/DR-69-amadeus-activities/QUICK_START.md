# DR-69 Amadeus Activities - Quick Start Guide

## 🚀 Running Tests

### All Tests
```bash
cd dreamscape-tests
npm run test:dr69
```

### Unit Tests Only
```bash
npm run test:dr69:unit
```

### Integration Tests Only
```bash
npm run test:dr69:integration
```

### E2E Tests Only
```bash
npm run test:dr69:e2e
```

### With Coverage
```bash
npm run test:dr69:coverage
```

## ✅ Test Results (as of 2025-12-19)

**Unit Tests:** ✅ 18/18 PASSING
- ActivityMapper.test.ts: All tests green

**Integration Tests:** ⏳ Requires Voyage Service running
- activity-search.test.ts: Ready to run

**E2E Tests:** ⏳ Requires Voyage Service running
- activity-booking-workflow.test.ts: Ready to run

## 📋 Prerequisites for Integration/E2E Tests

1. Start Voyage Service:
```bash
cd ../dreamscape-services/voyage
npm run dev
```

2. Ensure Amadeus credentials are configured:
```bash
# In dreamscape-services/voyage/.env
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_BASE_URL=https://test.api.amadeus.com
```

3. Run tests:
```bash
cd ../../dreamscape-tests
npm run test:dr69
```

## 🔍 What's Being Tested

### Unit Tests (ActivityMapper.test.ts)
- ✅ Mapping Amadeus API response to simplified DTO
- ✅ Location name extraction from multiple sources
- ✅ City detection from coordinates
- ✅ Price formatting with currency symbols
- ✅ Category and tag extraction
- ✅ Duration, group size parsing
- ✅ Booking info and cancellation policy

### Integration Tests (activity-search.test.ts)
- ✅ GET /api/activities/search with coordinates
- ✅ Search in all 8 Amadeus test cities
- ✅ Validation of required parameters
- ✅ Location name mapping verification
- ✅ Cache performance testing
- ✅ Error handling

### E2E Tests (activity-booking-workflow.test.ts)
- ✅ Complete booking workflow (5 steps)
- ✅ Multi-city search
- ✅ Activity filtering by category and price
- ✅ Booking validation
- ✅ Performance benchmarking

## 📊 Test Coverage

Run with coverage to see detailed metrics:
```bash
npm run test:dr69:coverage
```

## 🐛 Troubleshooting

### "Cannot find module ActivityMapper"
- Ensure you're in the correct directory: `cd dreamscape-tests`
- The import path is relative: `../../../../dreamscape-services/voyage/src/mappers/ActivityMapper`

### Integration tests fail with connection error
- Start the Voyage Service first: `cd ../dreamscape-services/voyage && npm run dev`
- Check VOYAGE_SERVICE_URL (default: http://localhost:3003)

### All activities show "Unknown Location"
- Check that `locationName` parameter is passed in API request
- Verify coordinates match Amadeus test city coordinates exactly

## 📚 More Information

See [README.md](README.md) for complete documentation.
