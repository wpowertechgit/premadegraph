# Multi-API-Key Rate Limit Rotation Implementation

## Task Summary

Implement simultaneous rotation of multiple Riot API keys in `backend/match_collector.py` to increase effective rate limit throughput during long-running match collection cycles.

## Objective

Enable `match_collector.py` to use both an **app-tier API key** and a **developer-tier API key** concurrently, rotating between them to combine their rate limit buckets and reduce overall collection time.

---

## Requirements

### 1. Configuration & Key Storage

- [ ] Accept two API keys via environment variables:
  - `RIOT_API_KEY_APP` (app-tier key, permanent)
  - `RIOT_API_KEY_DEVELOPER` (developer-tier key, regenerated every 24h)
- [ ] Fallback gracefully if only one key is provided (use single-key mode)
- [ ] Validate keys are non-empty at startup; warn if only one is available
- [ ] Store keys in a structured list for easy rotation
- [ ] Track **injection timestamp** for the secondary dev key
- [ ] Calculate **24-hour expiration deadline** from injection time
- [ ] Log warning 1 hour before expiration (dev key will soon become invalid)
- [ ] Display remaining time in backend logs and frontend UI

### 2. Key Rotation Strategy

Implement **round-robin distribution** as the initial approach:

- [ ] Maintain a rotation index (starting at 0)
- [ ] Each API call selects the next key in sequence
- [ ] Wrap around when reaching the end of the key list
- [ ] Log which key was used for each API call (debug level)

**Example flow:**
```
Call 1 → app-key (index 0)
Call 2 → dev-key (index 1)
Call 3 → app-key (index 0)
Call 4 → dev-key (index 1)
... repeat
```

### 3. Rate Limit Tracking Per Key

- [ ] Track request timestamps for each key independently
- [ ] Maintain separate counters:
  - Requests-per-second limit (per key)
  - Requests-per-2-minute limit (per key)
- [ ] When a key approaches its limit, delay calls using that key
- [ ] Do NOT switch to another key early (keep round-robin strict)

### 3b. Secondary Key Expiration Tracking & Frontend Integration

**Backend:**

- [ ] Create `/api/match-collector/dev-key-status` endpoint that returns:
  ```json
  {
    "devKeyActive": true,
    "injectionTime": "2026-04-27T14:30:00Z",
    "expirationTime": "2026-04-28T14:30:00Z",
    "hoursRemaining": 23.5,
    "warningLevel": "none" | "warning" | "expired"
  }
  ```
- [ ] If `hoursRemaining < 1`, set `warningLevel: "warning"`
- [ ] If `hoursRemaining < 0`, set `warningLevel: "expired"` and dev key becomes inactive
- [ ] Log at WARN level when less than 1 hour remains

**Frontend (Navbar):**

- [ ] Add navbar component (or extend existing MatchCollectorPage) with:
  - Text display: "Dev Key: [HH:MM:SS] remaining" in a badge/chip
  - Color coding: Green (>4h), Yellow (1-4h), Red (<1h or expired)
  - Input field: Allow user to paste new dev key directly
  - Submit button: "Update Dev Key" triggers API endpoint
- [ ] Create `/api/match-collector/update-dev-key` POST endpoint:
  - Accept new dev key in request body
  - Update environment variable or config
  - Reset injection timestamp to current time
  - Return updated status immediately
  - Log key update event (with timestamp)
- [ ] Auto-refresh dev key status every 30 seconds while collector is running
- [ ] Display prominent warning if key is about to expire during active collection

### 4. HTTP 429 Handling

When a 429 (Too Many Requests) response occurs:

- [ ] Extract `Retry-After` header
- [ ] Mark the specific key as rate-limited until `Retry-After` expires
- [ ] Continue using other available keys (don't stall the entire collector)
- [ ] Log the rate limit hit with key ID and retry duration
- [ ] If all keys hit rate limit simultaneously, pause collection and wait

### 5. Code Structure

Refactor the API call pattern:

- [ ] Create a new `MultiKeyRotator` class or function:
  ```python
  class APIKeyRotator:
      def __init__(self, keys: List[str]):
          self.keys = keys
          self.current_index = 0
          self.rate_limit_state = {}  # per-key state tracking
      
      def get_next_key(self) -> str:
          key = self.keys[self.current_index]
          self.current_index = (self.current_index + 1) % len(self.keys)
          return key
      
      def wait_if_needed(self, key: str):
          # Check rate limit state for this key, sleep if needed
          pass
  ```

- [ ] Update all API request functions to use `rotator.get_next_key()` instead of a single static key
- [ ] Consolidate rate-limit wait logic into `wait_if_needed(key)`

### 6. Logging & Observability

- [ ] Log at DEBUG level: "Using key [app/dev] for request to [endpoint]"
- [ ] Log at INFO level: "Rate limit hit on key [app/dev], retry-after: [N] seconds"
- [ ] Log at INFO level: "All keys rate-limited, pausing collection for [N] seconds"
- [ ] Preserve existing match collection progress logs (don't clutter output)

### 7. Configuration File Support (Optional)

- [ ] Consider storing key strategy in `apex-flex-collector.json`:
  ```json
  "apiKeys": {
    "multiKeyMode": true,
    "rotationStrategy": "round-robin"
  }
  ```
- [ ] Allow switching between single-key and multi-key modes via config
- [ ] Default: auto-detect (if 2 keys available, use multi-key)

### 8. Testing & Validation

- [ ] Test with both keys available (verify rotation works)
- [ ] Test with only one key available (verify fallback)
- [ ] Test rate limit handling (simulate 429 response, verify retry-after)
- [ ] Test dev key expiration tracking (verify 24h countdown accuracy)
- [ ] Test navbar dev key injection (verify new key is applied immediately)
- [ ] Test dev key status endpoint (verify JSON response is correct)
- [ ] Test dev key warning levels (none → warning → expired states)
- [ ] Verify match collection completes without data loss
- [ ] Verify no duplicate requests due to rotation logic

---

## Implementation Notes

### Scope Limits

- **In scope:** Round-robin rotation, per-key rate limit tracking, 429 retry handling
- **Out of scope:** Intelligent queue-aware distribution (save for v2 if needed)
- **Out of scope:** Distributed rate limit sharing across multiple collector instances

### Backward Compatibility

- [ ] Existing single-key configs must continue to work
- [ ] If `RIOT_API_KEY_APP` is set but `RIOT_API_KEY_DEVELOPER` is empty, use single-key mode silently

### Files to Modify

- `backend/match_collector.py` — main implementation
- `backend/server.js` — add `/api/match-collector/dev-key-status` and `/api/match-collector/update-dev-key` endpoints
- `frontend/src/MatchCollectorPage.tsx` — add navbar badge showing dev key countdown + input field for key injection
- Environment setup (`.env` or Docker config) — add `RIOT_API_KEY_DEVELOPER` variable with injection timestamp tracking
- `backend/collector_configs/apex-flex-collector.json` (optional) — add multiKeyMode flag

### Files to Review First

- Current rate limit handling logic in `match_collector.py`
- Current API call patterns (identify all `requests.get()` calls that need key injection)
- Checkpoint persistence (ensure multi-key rotation state is NOT saved; reset each run)

---

## Success Criteria

✅ Both API keys are accepted via environment variables  
✅ Round-robin rotation occurs (verified in logs)  
✅ Rate limits are tracked independently per key  
✅ Dev key expiration is tracked and displayed (24h countdown accurate)  
✅ User can inject new dev key via navbar without restarting backend  
✅ Dev key warning levels display correctly (green/yellow/red badges)  
✅ Collection completes faster than single-key baseline (measure: time to 3000+ matches)  
✅ No HTTP 403 or 429 errors left unhandled  
✅ Logs clearly show which key was used for rate limit violations  
✅ Existing flexset collection continues to work with corrected config  

---

## Estimated Effort

- **Small:** 2–4 hours
- **Implementation risk:** Low (isolated to API layer)
- **Testing risk:** Low (easy to validate with logs)

---

## Next Steps After Implementation

1. Run fresh flexset collection with multi-key enabled
2. Measure wall-clock time vs previous single-key runs
3. Log analysis: verify both keys are being used evenly
4. Compare 429 error frequency vs baseline
5. If successful, document in README for future collection runs
