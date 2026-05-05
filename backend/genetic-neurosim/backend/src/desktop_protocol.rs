pub const DESKTOP_FRAME_MAGIC: &[u8; 4] = b"TNS3";
pub const DESKTOP_FRAME_VERSION: u16 = 1;
pub const DESKTOP_FRAME_HEADER_BYTES: usize = 32;
pub const PAYLOAD_KIND_TRIBAL_LEGACY_V0: u16 = 1;

pub fn wrap_tribal_legacy_frame(payload: &[u8]) -> Vec<u8> {
    let tick = legacy_tick(payload);
    let generation = read_u32_or_zero(payload, 16);
    let record_count = read_u32_or_zero(payload, 8);

    let mut wrapped = Vec::with_capacity(DESKTOP_FRAME_HEADER_BYTES + payload.len());
    wrapped.extend_from_slice(DESKTOP_FRAME_MAGIC);
    wrapped.extend_from_slice(&DESKTOP_FRAME_VERSION.to_le_bytes());
    wrapped.extend_from_slice(&(DESKTOP_FRAME_HEADER_BYTES as u16).to_le_bytes());
    wrapped.extend_from_slice(&PAYLOAD_KIND_TRIBAL_LEGACY_V0.to_le_bytes());
    wrapped.extend_from_slice(&0_u16.to_le_bytes());
    wrapped.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    wrapped.extend_from_slice(&tick.to_le_bytes());
    wrapped.extend_from_slice(&generation.to_le_bytes());
    wrapped.extend_from_slice(&record_count.to_le_bytes());
    wrapped.extend_from_slice(payload);
    wrapped
}

fn legacy_tick(payload: &[u8]) -> u64 {
    let tick_low = read_u32_or_zero(payload, 0) as u64;
    let tick_high = read_u32_or_zero(payload, 4) as u64;
    (tick_high << 32) | tick_low
}

fn read_u32_or_zero(payload: &[u8], offset: usize) -> u32 {
    if payload.len() < offset + 4 {
        return 0;
    }

    u32::from_le_bytes(payload[offset..offset + 4].try_into().expect("slice length checked"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_legacy_frame() -> Vec<u8> {
        let mut frame = Vec::new();
        frame.extend_from_slice(&42_u32.to_le_bytes());
        frame.extend_from_slice(&1_u32.to_le_bytes());
        frame.extend_from_slice(&3_u32.to_le_bytes());
        frame.extend_from_slice(&2_u32.to_le_bytes());
        frame.extend_from_slice(&7_u32.to_le_bytes());
        frame.extend_from_slice(&[9, 8, 7, 6]);
        frame
    }

    #[test]
    fn wraps_legacy_payload_with_desktop_v1_header() {
        let legacy = sample_legacy_frame();
        let wrapped = wrap_tribal_legacy_frame(&legacy);

        assert_eq!(&wrapped[0..4], DESKTOP_FRAME_MAGIC);
        assert_eq!(read_u16(&wrapped, 4), DESKTOP_FRAME_VERSION);
        assert_eq!(read_u16(&wrapped, 6), DESKTOP_FRAME_HEADER_BYTES as u16);
        assert_eq!(read_u16(&wrapped, 8), PAYLOAD_KIND_TRIBAL_LEGACY_V0);
        assert_eq!(read_u32(&wrapped, 12), legacy.len() as u32);
        assert_eq!(&wrapped[DESKTOP_FRAME_HEADER_BYTES..], legacy.as_slice());
    }

    #[test]
    fn copies_legacy_tick_generation_and_record_count_into_header() {
        let wrapped = wrap_tribal_legacy_frame(&sample_legacy_frame());

        assert_eq!(read_u64(&wrapped, 16), (1_u64 << 32) | 42_u64);
        assert_eq!(read_u32(&wrapped, 24), 7);
        assert_eq!(read_u32(&wrapped, 28), 3);
    }

    fn read_u16(bytes: &[u8], offset: usize) -> u16 {
        u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap())
    }

    fn read_u32(bytes: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
    }

    fn read_u64(bytes: &[u8], offset: usize) -> u64 {
        u64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap())
    }
}
