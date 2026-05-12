// ─── FrameV1 constants ───────────────────────────────────────────────────────

// E1: extended from 50 → 88 to carry fitness, migration target, ally id, and 7 NN outputs.
pub const FRAME_V1_TRIBE_RECORD_BYTES: usize = 88;
pub const FRAME_V1_TILE_RECORD_BYTES: usize = 9;
pub const FRAME_V1_WAR_RECORD_BYTES: usize = 21;
pub const FRAME_V1_EVENT_RECORD_BYTES: usize = 5;

// Flags in the section-flags byte
pub const FLAG_TILE_DATA: u8 = 0x01;
pub const FLAG_WAR_DATA: u8 = 0x02;
pub const FLAG_EVENT_DATA: u8 = 0x04;
pub const FLAG_TERRITORY_DATA: u8 = 0x08;

// ─── Encoder helpers ─────────────────────────────────────────────────────────

#[inline]
pub fn push_u16(buf: &mut Vec<u8>, v: u16) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[inline]
pub fn push_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[inline]
pub fn push_u64(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

#[inline]
pub fn push_f32(buf: &mut Vec<u8>, v: f32) {
    buf.extend_from_slice(&v.to_le_bytes());
}
