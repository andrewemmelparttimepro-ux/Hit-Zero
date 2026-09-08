-- Apply after join-gym-v1 uses save_family_packet_v2. Legacy rows remain unchanged.
alter table public.family_info_packets drop constraint family_info_packets_program_id_profile_id_key;
