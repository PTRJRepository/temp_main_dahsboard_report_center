# PRD — Sistem Monitoring WiFi & LAN Terpadu

**Nama produk:** Rebinmas Jaya Network Observability & Cable Intelligence  
**Versi dokumen:** 1.0  
**Status:** Draft implementasi  
**Bahasa:** Indonesia  
**Target pengguna:** Tim IT, Network Engineer, Helpdesk, Auditor TI, Manajer Operasional  

---

## 1. Ringkasan Eksekutif

Rebinmas Jaya adalah sistem observability jaringan yang menggabungkan monitoring perangkat jaringan, inventaris IP/MAC, pemetaan port switch–patch panel–kabel–endpoint, serta monitoring WiFi dalam satu console operasional. Tujuan utamanya adalah menjawab pertanyaan operasional berikut dalam hitungan detik:

1. **Perangkat/IP ini ada di mana?**
2. **Komputer apa yang sedang atau terakhir terhubung ke port switch ini?**
3. **Saat sebuah kabel LAN dicabut, port mana yang down dan IP/hostname apa yang terakhir berada pada kabel tersebut?**
4. **Access point, switch, uplink, atau VLAN mana yang menyebabkan gangguan?**
5. **Bagaimana jalur fisik dan logis dari router sampai perangkat pengguna?**

Produk tidak hanya menampilkan grafik monitoring. Produk menyimpan **evidence snapshot** pada waktu kejadian: status port, MAC address forwarding table, ARP/DHCP lease, alamat IP, hostname, user/asset tag (bila tersedia), lokasi fisik, dan mapping patch panel. Dengan begitu teknisi dapat membedakan antara “perangkat sedang aktif” dan “perangkat terakhir terlihat sebelum kabel dicabut.”

---

## 2. Masalah yang Diselesaikan

### 2.1 Kondisi saat ini yang umum terjadi

- Ketika koneksi komputer putus, teknisi harus menelusuri switch, kabel, patch panel, dan ruangan secara manual.
- Informasi IP, MAC address, hostname, nomor port, dan lokasi perangkat tersimpan terpisah atau tidak terdokumentasi.
- Saat kabel dicabut, tabel MAC/ARP dapat segera berubah sehingga bukti perangkat sebelumnya hilang.
- WiFi dipantau terpisah dari LAN, padahal kegagalan DHCP, uplink switch, VLAN, atau access point saling terkait.
- Switch unmanaged dan kabel tidak berlabel menyebabkan satu port tidak dapat ditelusuri secara pasti sampai ke perangkat akhir.

### 2.2 Dampak bisnis

- Waktu penanganan insiden (MTTR) tinggi.
- Risiko salah cabut kabel atau salah konfigurasi port.
- Sulit membuktikan penyebab gangguan dan histori perubahan.
- Audit aset jaringan serta kepatuhan dokumentasi menjadi lemah.

---

## 3. Tujuan Produk

### 3.1 Tujuan utama

- Menurunkan waktu identifikasi sumber gangguan kabel/LAN/WiFi.
- Menyediakan satu sumber data yang dapat dipercaya untuk perangkat, IP, MAC, VLAN, port, dan lokasi.
- Mendeteksi kejadian **link down/up**, perubahan MAC pada port, perubahan IP, AP down, client roaming, serta kualitas WiFi.
- Menampilkan mapping visual dan tabel detail yang mudah digunakan saat insiden.
- Menyimpan audit trail dan bukti historis sebelum/ketika/setelah perubahan koneksi.

### 3.2 Target hasil operasional

| Indikator | Target awal |
|---|---:|
| Deteksi perubahan port dengan SNMP trap/syslog | ≤ 10 detik |
| Deteksi fallback dengan polling | ≤ 60 detik |
| Waktu pencarian IP/MAC/hostname | ≤ 3 detik |
| Akurasi port → MAC pada switch managed | ≥ 98% setelah discovery stabil |
| Akurasi port → IP | ≥ 95% bila DHCP/ARP tersedia |
| Akurasi kabel sampai outlet/perangkat akhir | ≥ 95% hanya untuk jalur yang sudah dilabeli/didokumentasikan |
| Audit event dan perubahan konfigurasi | 100% tercatat |

---

## 4. Batasan Penting dan Prinsip Akurasi

### 4.1 Yang dapat dideteksi secara otomatis

Pada **switch managed** yang dapat diakses melalui SNMPv3/API/SSH read-only, sistem dapat mengambil:

- Nama dan status port (admin/operational status, link up/down, speed, duplex).
- MAC address table / forwarding database pada setiap port.
- Counter error, traffic, packet drop, PoE, VLAN, dan uplink.
- Neighbor LLDP/CDP untuk perangkat jaringan yang mendukungnya.
- Event link down/up melalui SNMP trap atau syslog.
- Hubungan IP ↔ MAC dari DHCP lease, ARP table gateway/L3 switch, atau IPAM.

### 4.2 Yang membutuhkan data tambahan

| Kebutuhan | Data/infrastruktur wajib | Hasil |
|---|---|---|
| Mengetahui IP saat kabel baru dicabut | Event port + snapshot MAC/FDB/ARP/DHCP sebelum/ketika event | IP terakhir yang terasosiasi dengan port |
| Mengetahui nama komputer | DHCP reservation/lease, DNS, agent endpoint, AD/Entra/MDM, atau CMDB | Hostname dengan confidence score |
| Mengetahui kabel sampai outlet dinding | Label kabel + mapping port switch → patch panel → outlet | Trace fisik yang dapat diaudit |
| Mengetahui pengguna komputer | Endpoint agent/AD/MDM/EDR sesuai kebijakan privasi | User terakhir/logged-in, bersifat opsional |
| Deteksi kabel putus pada jalur pasif | Switch managed atau cable tester/sensor fisik | Link down; lokasi fisik perlu dokumentasi |

### 4.3 Keterbatasan yang harus ditampilkan di UI

- **IP bukan identitas permanen.** DHCP dapat memindahkan IP ke perangkat lain. UI wajib menampilkan timestamp dan sumber bukti.
- **Unmanaged switch/hub membuat hasil ambigu.** Satu port upstream dapat memuat banyak MAC address; sistem harus menandai sebagai `Ambiguous / downstream unmanaged`.
- **Kabel pasif tidak bisa “dikenali” hanya dari IP.** Agar dapat menunjukkan nomor kabel, patch panel dan outlet harus mempunyai label dan database mapping.
- **OS/perangkat komputer tidak selalu dapat dipastikan hanya dari MAC/IP.** Sistem harus membedakan `Verified`, `Inferred`, dan `Unknown`.
- **LLDP/CDP adalah data neighbor, bukan pengganti dokumentasi kabel.** LLDP lebih kuat untuk koneksi antar perangkat jaringan daripada banyak endpoint pengguna.

---

## 5. Persona dan Hak Akses

| Persona | Kebutuhan utama | Akses |
|---|---|---|
| Super Admin | Menyetel integrasi, credential, role, retention | Semua modul dan konfigurasi |
| Network Engineer | Menelusuri insiden, topology, port, WiFi, alert | Operasional penuh, tanpa manajemen user tingkat global |
| IT Support / Helpdesk | Menjawab lokasi perangkat dan keluhan koneksi | Lookup, trace, acknowledge alert, tanpa edit konfigurasi sensitif |
| Asset/Facility Admin | Mengelola label kabel, ruangan, outlet, patch panel | Inventaris fisik dan master data |
| Auditor / Viewer | Memeriksa histori, bukti, audit trail | Read-only dan export terbatas |

Prinsip akses: **least privilege**, RBAC per lokasi/site, audit untuk setiap perubahan mapping fisik dan konfigurasi device.

---

## 6. Ruang Lingkup Modul

### 6.1 Dashboard Operasional (P0)

- Ringkasan availability perangkat: router, firewall, core switch, access switch, controller, access point.
- Kartu status: Critical, Warning, Unknown, Maintenance, Healthy.
- Feed event real-time: `Port Down`, `Port Up`, `MAC moved`, `AP offline`, `High packet error`, `DHCP anomaly`.
- Tabel padat/table-first untuk perangkat dan insiden terbaru.
- Filter global: site, gedung, lantai, VLAN, jenis perangkat, status, rentang waktu.
- Klik satu event membuka context drawer tanpa meninggalkan dashboard.

### 6.2 Cable Trace & Endpoint Lookup (P0 — fitur inti)

Input pencarian tunggal menerima:

- IP address, MAC address, hostname, asset tag, serial number, user label, nomor kabel, nomor outlet, nama switch, atau port.

Output trace wajib menampilkan:

1. Identitas endpoint (hostname, OS bila terverifikasi, asset tag, MAC, IP, last seen).
2. Lokasi fisik (site, gedung, lantai, ruangan, meja bila tersedia).
3. Jalur logis: gateway/VLAN → switch → port → MAC/IP.
4. Jalur fisik: switch port → patch panel → cable label → wall outlet → endpoint.
5. Bukti dan confidence: sumber, waktu, dan status `Verified / Correlated / Inferred / Unknown`.
6. Timeline event: link up/down, DHCP lease, MAC move, IP change, topology change.
7. Tombol “Buat tiket insiden”, “Tandai investigasi”, dan “Export evidence”.

**Skenario wajib:** ketika kabel dicabut dari endpoint atau outlet, sistem membuat event `Link Down`, menyimpan snapshot terakhir dari port tersebut, lalu menampilkan: switch, port, kabel/patch-panel (bila termapping), MAC terakhir, IP terakhir, hostname terakhir, dan waktu kejadian.

### 6.3 Topology Map (P1)

- Layer fisik dan layer logis dapat diaktifkan terpisah.
- Node: internet/WAN, firewall, router, core switch, access switch, AP, endpoint group, patch panel.
- Edge warna/status: healthy, degraded, down, unknown, maintenance.
- Klik node membuka inventory / health / ports / dependencies.
- Klik edge membuka cable trace dan recent events.
- Mode fokus otomatis: user mencari IP lalu tampilan hanya menyorot jalur terkait.
- Layout map untuk site kecil dan mode hierarchical untuk jaringan multi-site.

### 6.4 Switch Port Intelligence (P0)

Tabel per port memuat:

- Switch, port, alias/description, admin state, operational state, speed/duplex, VLAN/access/trunk, PoE, error/discard, traffic in/out, MAC list, IP correlations, neighbor, cable label, outlet/room, last change, dan status monitoring.
- Filter `only down`, `only errors`, `unmapped cable`, `multiple MAC`, `PoE issue`, `newly changed`.
- Tampilan `before / event / after` untuk event port.
- Konfirmasi/manual correction mapping dengan alasan dan audit trail.

### 6.5 WiFi Observability (P1)

- Status controller, AP, SSID, radio 2.4/5/6 GHz, uplink, PoE, channel, channel utilization, client count, retry/error, RSSI/SNR, roaming, dan DHCP failures.
- Heat/coverage map bersifat opsional dan membutuhkan denah lokasi serta controller/API yang kompatibel.
- Drill-down client WiFi: MAC, IP, SSID, AP terakhir, radio, signal, authentication, roam history.
- Hubungkan client WiFi dengan IP/MAC/asset apabila data tersedia.

### 6.6 Inventory, IPAM dan Cable Plant (P0)

- Master lokasi: organisasi → site → gedung → lantai → ruangan → rack → patch panel → outlet.
- Master perangkat: vendor, model, serial, OS/firmware, management IP, role, ownership, lifecycle.
- IPAM: prefix, VLAN, gateway, DHCP scope, reserved IP, status penggunaan.
- Cable plant: cable label, tipe kabel, panjang, kategori, A-end, B-end, instalasi, status, foto/dokumen opsional.
- Import CSV/XLSX dan wizard initial discovery.

### 6.7 Alert, Incident, Evidence & Audit (P0)

- Rule engine: link down, core device unreachable, port flap, high error, MAC move, IP conflict, AP down, high WiFi retries, DHCP pool low.
- Deduplication dan correlation untuk menghindari ribuan alert turunan akibat satu uplink down.
- Incident timeline yang mengelompokkan root event dan downstream impact.
- Integrasi notifikasi: email, WhatsApp gateway organisasi/webhook, Telegram, Microsoft Teams, Slack, ticketing/ITSM.
- Evidence snapshot immutable secara aplikasi: event payload, poll result, source, collector, timestamp, operator action.
- Audit log: login, perubahan credential reference, perubahan mapping kabel, acknowledge/close alert, export data.

### 6.8 Reporting (P2)

- Availability per site/device/AP.
- Top 10 port flapping/error/traffic.
- IP utilization dan rogue/unknown device.
- Cable mapping completeness (% port yang memiliki label/mapping).
- Mean time to detect/acknowledge/resolve.
- Riwayat perangkat yang berpindah port atau site.
- Export CSV/XLSX/PDF dengan parameter dan audit record.

---

## 7. Alur Sistem: “Kabel Baru Dicabut, IP-nya Apa?”

### 7.1 Event-driven flow (prioritas)

1. Access switch mengirim SNMP trap atau syslog `linkDown` untuk port tertentu.
2. Collector menerima event, memberi UTC timestamp dan normalisasi vendor event.
3. Collector segera mengambil snapshot FDB/MAC table, port counters, VLAN, neighbor, serta cache snapshot terakhir sebelum event.
4. Correlation engine mencocokkan MAC terakhir dengan:
   - DHCP lease aktif/riwayat lease;
   - ARP/NDP table dari gateway/L3 switch/firewall;
   - IPAM/CMDB/asset registry;
   - DNS/endpoint agent (opsional).
5. Sistem membuat `Port Link Down Incident` dengan status evidence.
6. UI menampilkan “IP/hostname terakhir sebelum link down”, bukan mengklaim perangkat masih aktif.
7. Jika port naik lagi dan MAC sama muncul kembali, insiden dihubungkan sebagai `recovered`; bila MAC berubah, sistem memberi `possible cable/device move`.

### 7.2 Fallback polling flow

Jika trap/syslog belum tersedia, collector mem-poll port dan FDB setiap 30–60 detik. Akurasi waktu menjadi lebih rendah; UI wajib menampilkan label `poll-detected` dan interval observasi.

### 7.3 Contoh hasil yang benar

> **SW-ARA-01 / Gi1/0/18** berubah `up → down` pada **08:42:16 WIB**. Snapshot 08:42:10 mencatat MAC `D4:3D:7E:AA:12:44`, VLAN 120, IP terakhir `10.30.12.45`, hostname terakhir `PC-ACA-014`. Jalur fisik terdaftar: `PP-A1-03/18 → Cable CAT6-A1-018 → Outlet A1-12`. Confidence: `Correlated` (FDB + DHCP + ARP), bukan `Verified endpoint agent`.

---

## 8. Arsitektur Solusi

### 8.1 Komponen utama

```text
Managed Switch / Router / Firewall / WiFi Controller / AP
      | SNMPv3, Trap, Syslog, Streaming/API, NetFlow/sFlow (opsional)
      v
Collector / Site Probe (di tiap site bila diperlukan)
      | normalisasi, polling, cache bukti, queue tahan jaringan putus
      v
Ingestion & Correlation Service
      | port/FDB/ARP/DHCP/LLDP/IPAM/CMDB correlation
      +--> Event & Alert Engine
      +--> Topology Engine
      +--> Discovery Engine
      v
Data Layer
      | PostgreSQL + time-series extension | Redis | object storage (export/evidence)
      v
API / WebSocket / RBAC / Audit
      v
Web Console (Dashboard, Trace, Topology, WiFi, Inventory, Reports)
```

### 8.2 Pola deployment

- **Single-site small:** satu server aplikasi + collector + database pada VM tersegmentasi.
- **Multi-site:** collector lokal per site, control plane pusat, koneksi outbound TLS dari collector ke pusat.
- **High availability:** API dan worker stateless multi-replica; PostgreSQL HA; queue durable; backup terenkripsi.
- **Air-gapped / restricted:** collector dan UI on-premise; integrasi external dinonaktifkan.

### 8.3 Sumber data dan urutan kepercayaan

| Prioritas | Sumber | Nilai utama |
|---:|---|---|
| 1 | Endpoint agent / MDM / EDR / AD connector | Hostname, asset, OS, user dengan bukti tinggi |
| 2 | DHCP server | IP ↔ MAC ↔ lease time |
| 3 | L3 switch/router/firewall ARP/NDP | IP ↔ MAC di jaringan aktif |
| 4 | Switch FDB/MAC table + port state | MAC ↔ port, bukti kabel/port |
| 5 | LLDP/CDP | Neighbor perangkat jaringan |
| 6 | DNS, NetBIOS, passive fingerprint | Enrichment, confidence rendah-menengah |
| 7 | Input manual / import spreadsheet | Mapping fisik, perlu review dan audit |

---

## 9. Kebutuhan Integrasi

### 9.1 Wajib untuk MVP

- SNMPv3 read-only untuk switch managed, router, firewall, dan AP/controller bila tersedia.
- SNMP Trap atau Syslog dari switch untuk event link up/down (sangat disarankan).
- DHCP server lease export/API atau read-only database/view.
- Gateway/L3 switch/firewall ARP table melalui SNMP/API/SSH read-only.
- DNS lookup internal opsional tapi disarankan.
- CSV/XLSX import untuk inventory, patch panel, cable label, outlet, VLAN, dan perangkat.

### 9.2 Opsional bernilai tinggi

- API WiFi Controller (Cisco, Aruba, UniFi, Fortinet, MikroTik, Ruckus, TP-Link Omada, dll sesuai vendor).
- NetFlow/sFlow/IPFIX untuk traffic analytics.
- Endpoint agent / MDM / EDR / Active Directory / Entra ID.
- NetBox/CMDB/ITSM integration.
- QR code/label printer untuk patch panel, outlet, dan kabel.

### 9.3 Vendor adapter strategy

Core aplikasi menggunakan data model netral vendor. Setiap vendor memiliki adapter (`snmp_generic`, `cisco`, `aruba`, `ubiquiti`, `fortinet`, `mikrotik`, dll). Adapter wajib memiliki test fixture dan capability matrix agar UI tidak menjanjikan metrik yang perangkat tidak dukung.

---

## 10. Kebutuhan Fungsional Terperinci

### FR-01 — Discovery perangkat

- Sistem dapat melakukan discovery dari seed IP/range/site.
- Sistem mengidentifikasi device type, management IP, hostname, vendor, model, serial (bila tersedia), interface, uptime, dan capability.
- Discovery tidak boleh melakukan perubahan konfigurasi perangkat.
- Device hasil discovery masuk status `Discovered / Pending Approval` sebelum otomatis menjadi inventory resmi, tergantung policy.

### FR-02 — Discovery interface/port

- Mengambil nama port, ifIndex, alias, status admin/operasional, speed, duplex, MTU, counters, VLAN, PoE, error, discards.
- Menyimpan snapshot waktu dan delta perubahan.
- Menandai port trunk, access, uplink, disabled, unused, dan uncertain.

### FR-03 — MAC/IP correlation

- Memetakan FDB MAC → switch port.
- Mencocokkan MAC dengan ARP/NDP dan DHCP lease untuk memperoleh IP historis/aktif.
- Menyimpan `valid_from`, `valid_to`, source, confidence, dan conflict status.
- Jika lebih dari satu IP/MAC ditemukan pada port, UI menampilkan semua bukti dan penyebab kemungkinan.

### FR-04 — Cable/patch mapping

- Memodelkan termination A dan B; satu kabel dapat terhubung ke switch port, patch-panel port, faceplate/outlet, atau endpoint NIC.
- Mendukung status `documented`, `verified physical`, `needs review`, `retired`.
- Mendukung scan QR pada kabel/patch panel dari mobile view (P2).
- Tidak boleh menghapus histori mapping; perubahan membuat versi dan audit log.

### FR-05 — Link event & forensic snapshot

- Menerima event `linkUp/linkDown`, flap, power change, PoE issue, FDB MAC change.
- Saat event down, mengambil `last_known_endpoint` berdasarkan snapshot time window yang dapat dikonfigurasi.
- Menyimpan minimal: port, status sebelum/sesudah, MAC list, VLAN, IP correlations, neighbor, counters, cable mapping, source payload, collector ID.
- Memberikan label bukti `Observed Live`, `Correlated`, `Inferred`, `Manual`.

### FR-06 — WiFi monitoring

- Mengambil AP online/offline, uplink, clients, SSID, radio stats, channel, channel utilization, retries/errors, power, temperature bila perangkat mendukung.
- Menampilkan client device dari MAC/IP/SSID/AP dan histori roaming.
- Menghubungkan alarm AP dengan status port switch/PoE/uplinknya.

### FR-07 — Alerting dan correlation

- Rule dapat disusun berdasarkan device role, site, port type, severity, schedule maintenance, duration, dan count threshold.
- Ketika uplink/core down, child alert disuppress/correlate agar operator fokus pada root cause.
- Alert memiliki lifecycle: `Open → Acknowledged → Investigating → Resolved → Closed`.
- Semua perubahan lifecycle tercatat dengan user, waktu, dan catatan.

### FR-08 — Search & evidence export

- Global search bekerja untuk IP, MAC, hostname, switch/port, cable label, asset tag, room, dan user label.
- Hasil menampilkan waktu observasi, source, status, dan confidence.
- Evidence export menghasilkan ringkasan kejadian + jalur mapping + raw evidence terpilih, dengan watermark dan audit record.

---

## 11. Kebutuhan Non-Fungsional

| Area | Requirement |
|---|---|
| Availability | Target aplikasi 99.5% untuk tahap awal; collector tetap queue event bila pusat tidak tersedia |
| Performance | Halaman lookup p95 ≤ 3 detik untuk 100k endpoint history; realtime event p95 ≤ 10 detik bila trap tersedia |
| Scalability | MVP: 50 site / 2.000 managed devices / 100.000 ports / 50.000 endpoint history; horizontal worker scale |
| Security | SNMPv3 authPriv, TLS, read-only credential, secrets vault, RBAC, MFA/SSO opsional, audit immutable secara logis |
| Data integrity | UTC internal + tampilan WIB; idempotent ingestion; source/timestamp seluruh correlation; no destructive overwrite histori |
| Privacy | User/OS/asset data bersifat opt-in per policy; masking IP/MAC pada role tertentu; retention configurable |
| Observability | Log terstruktur, metric aplikasi, tracing collector, health check, dead-letter queue |
| Backup | Daily encrypted backup, restore test berkala, retention event configurable |
| Accessibility | Keyboard navigation, contrast tinggi, status tidak hanya dibedakan warna, mobile technician view |

---

## 12. Data Model Inti

### 12.1 Entitas utama

| Entitas | Field minimum |
|---|---|
| `sites` | id, name, code, timezone, address, status |
| `locations` | id, site_id, type, parent_id, name, floor, room, rack |
| `network_devices` | id, site_id, vendor, model, serial, hostname, mgmt_ip, role, monitoring_state |
| `interfaces` | id, device_id, ifindex, name, alias, type, admin_state, oper_state, speed, vlan, poe_state |
| `mac_observations` | id, mac, interface_id, vlan_id, observed_at, last_seen_at, source, confidence |
| `ip_observations` | id, ip, mac, prefix_id, hostname, observed_at, lease_start, lease_end, source, confidence |
| `endpoints` | id, asset_tag, hostname, os_name, owner_ref, primary_mac, lifecycle, confidence |
| `endpoint_bindings` | endpoint_id, mac, ip, interface_id, valid_from, valid_to, evidence_level |
| `cables` | id, label, cable_type, category, length_m, a_termination_id, b_termination_id, status |
| `terminations` | id, location_id, device_interface_id, patch_panel_port, outlet_code, label |
| `topology_edges` | id, source_interface_id, target_interface_id, discovery_method, confidence, observed_at |
| `events` | id, event_type, severity, entity_type, entity_id, occurred_at, received_at, raw_payload |
| `evidence_snapshots` | id, event_id, snapshot_kind, payload_json, source, captured_at, hash |
| `alerts` | id, rule_id, correlation_key, status, opened_at, ack_at, resolved_at, assignee |
| `audit_logs` | id, actor_id, action, target_type, target_id, before_json, after_json, occurred_at |

### 12.2 Aturan historisasi

- Observasi bersifat append-only / time-bounded: `valid_from` dan `valid_to`.
- Mapping fisik kabel menggunakan versi; records lama tidak dihancurkan.
- Event snapshot menyimpan `payload_hash` untuk memastikan perubahan dapat dideteksi.
- Setiap correlation memiliki `source_priority`, `confidence_score`, dan `explanation` agar hasil dapat diaudit.

---

## 13. API Tingkat Tinggi

| Method | Endpoint | Tujuan |
|---|---|---|
| GET | `/api/v1/search?q=` | Pencarian IP/MAC/hostname/port/kabel |
| GET | `/api/v1/trace/{identifier}` | Jalur endpoint, port, kabel, evidence dan timeline |
| GET | `/api/v1/devices` | Device inventory dan filter |
| GET | `/api/v1/devices/{id}/interfaces` | Detail switch port |
| GET | `/api/v1/interfaces/{id}/history` | Historis link/MAC/IP/error |
| POST | `/api/v1/discovery/jobs` | Menjalankan discovery terkontrol |
| POST | `/api/v1/cable-mappings` | Membuat/versi mapping kabel |
| GET | `/api/v1/topology` | Graph topology per site/layer |
| GET | `/api/v1/wifi/clients/{mac}` | Detail client WiFi |
| GET | `/api/v1/events` | Feed event dan filter |
| POST | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |
| POST | `/api/v1/evidence-exports` | Request evidence export |

Catatan: API write harus menggunakan RBAC, idempotency key, audit log, serta approval opsional untuk perubahan mapping fisik.

---

## 14. UX / UI Requirements

### 14.1 Prinsip desain

- **Table-first NOC console:** banyak informasi terlihat sekaligus tanpa memaksa pengguna membuka banyak halaman.
- **Drill-down tanpa hilang konteks:** detail dibuka pada side drawer atau split-pane.
- **Evidence before assumption:** setiap IP/hostname yang tampil memiliki sumber dan timestamp.
- **Triage cepat:** status port/event selalu mudah dipindai melalui label, icon, severity, dan waktu absolut.
- **Dense but calm:** kontras tinggi, grid rapih, angka rata kanan, whitespace terukur, tidak memakai kartu besar berlebihan.
- **No hidden critical information:** tidak mengandalkan tooltip untuk data incident utama.

### 14.2 Navigasi utama

1. Overview
2. Live Events
3. Cable Trace
4. Topology
5. Switch Ports
6. WiFi
7. Inventory & IPAM
8. Cable Plant
9. Alerts & Incidents
10. Reports
11. Administration

### 14.3 Pola komponen utama

- Command search untuk lookup lintas entitas.
- Data table dengan column chooser, pin column, density setting, sticky filter, saved views, export.
- Status chip: `Healthy`, `Degraded`, `Down`, `Unknown`, `Maintenance`, `Evidence: Correlated`.
- Event drawer berisi **What happened / Last known endpoint / Trace / Evidence / Actions**.
- Topology map berpasangan dengan panel tabel list untuk memenuhi kebutuhan operator yang lebih nyaman dengan data tabular.

---

## 15. Acceptance Criteria MVP

### AC-01 — Deteksi kabel dicabut

**Given** switch managed, SNMPv3, trap/syslog, FDB, dan gateway ARP tersedia  
**When** kabel endpoint pada access port dicabut  
**Then** dalam ≤ 10 detik sistem membuat event port down dengan switch, port, waktu, status sebelum/sesudah, MAC terakhir, VLAN, IP terakhir bila berhasil dikorelasikan, dan source evidence.

### AC-02 — Trace dari IP

**Given** IP `10.30.12.45` memiliki observasi DHCP/ARP/FDB  
**When** operator mencari IP tersebut  
**Then** sistem menampilkan endpoint/hostname bila diketahui, MAC, switch-port terakhir, VLAN, lokasi, cable map bila tersedia, last seen time, dan confidence.

### AC-03 — Ambiguitas unmanaged switch

**Given** satu switch port mempelajari lebih dari satu MAC dari downstream unmanaged switch  
**When** operator membuka port tersebut  
**Then** sistem menandai `Ambiguous`, menampilkan semua MAC/IP yang terkait, dan tidak menyatakan satu perangkat sebagai kepastian.

### AC-04 — Audit mapping kabel

**Given** admin mengganti mapping port patch panel  
**When** mapping disimpan  
**Then** sistem menyimpan versi sebelumnya, versi baru, alasan, user, waktu, dan tidak mengubah histori event sebelumnya.

### AC-05 — Correlation insiden uplink

**Given** uplink access switch down  
**When** beberapa access port ikut berubah down  
**Then** sistem membuat root alert pada uplink dan mengelompokkan alert turunan agar operator tidak menerima alert flood.

---

## 16. Prioritas dan Roadmap

### Phase 0 — Foundation (2–4 minggu implementasi teknis, estimasi perlu disesuaikan kapasitas tim)

- Asset/location data model, RBAC, audit log, device onboarding.
- Generic SNMPv3 polling, device/interface inventory.
- Event ingestion via trap/syslog minimal.
- Import perangkat, VLAN, patch panel/outlet/cable dari CSV/XLSX.

### Phase 1 — MVP Cable Intelligence (4–8 minggu)

- FDB + ARP + DHCP correlation.
- Port Link Down evidence snapshot.
- Cable Trace, Switch Port table, Live Event dashboard.
- Alerting dasar dan export evidence.
- Reference topology sederhana.

### Phase 2 — WiFi & Topology Intelligence (4–8 minggu)

- Controller/AP integration, WiFi client observability.
- LLDP/CDP topology, dependency/correlation engine.
- Advanced filters, saved views, multi-site role scope.

### Phase 3 — Automation & Analytics (berkelanjutan)

- NetFlow/sFlow/IPFIX, capacity trend, anomaly detection.
- QR cable scanning, mobile field workflow, ticketing/CMDB sync.
- Approval workflow, configuration compliance, change intelligence.

---

## 17. Rekomendasi Infrastruktur Minimum

| Skala | Managed device | Rekomendasi awal |
|---|---:|---|
| Pilot | ≤ 100 | 4 vCPU / 16 GB RAM / 200 GB SSD; PostgreSQL; satu collector |
| Menengah | 100–1.000 | 8–16 vCPU / 32–64 GB RAM / SSD; queue/Redis; collector per site |
| Besar | > 1.000 | API/worker horizontal, PostgreSQL HA, time-series storage, object storage, proxy/collector per site |

Storage actual dipengaruhi interval polling, jumlah port, retention raw metric, NetFlow, dan snapshot evidence. Raw time-series harus memiliki retention/downsampling policy terpisah dari audit/event evidence.

---

## 18. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Switch tidak managed / SNMP tidak aktif | Tidak dapat identifikasi port secara akurat | Audit hardware, upgrade bertahap, label manual, tandai confidence rendah |
| Dokumentasi kabel buruk | Trace fisik tidak lengkap | Cable survey, QR labeling, import template, quality dashboard |
| DHCP/ARP tidak dapat diakses | IP terakhir tidak kuat | Integrasi read-only DHCP/gateway, keep short-term cache evidence |
| Polling terlalu lambat | Event kabel dicabut terlewat/kurang presisi | Trap/syslog, fast poll untuk access ports kritikal |
| Credential salah/kurang aman | Gagal monitoring/risiko keamanan | SNMPv3 authPriv, secret vault, rotating credential, health checks |
| Alert flood | Operator lelah dan kejadian penting terlewat | Root-cause correlation, maintenance windows, deduplication |
| Data user/endpoint sensitif | Risiko privasi | Role masking, policy retention, consent/policy organisasi, minimal collection |

---

## 19. Definisi Keberhasilan

Sistem dinilai berhasil saat helpdesk dapat menjawab insiden koneksi endpoint dengan alur berikut tanpa menebak:

1. Mencari IP/MAC/hostname atau kabel label.
2. Melihat switch dan port terakhir yang terasosiasi.
3. Melihat apakah link down, error, VLAN salah, PoE issue, atau downstream device ambigu.
4. Melihat bukti timestamp sebelum dan sesudah event.
5. Menelusuri jalur fisik ke patch panel/outlet bila mapping tersedia.
6. Menghasilkan bukti insiden untuk teknisi atau auditor dalam satu export.

---

## 20. Referensi Teknis untuk Validasi Implementasi

- **RFC 2863 — Interfaces Group MIB:** referensi status operasional interface (`ifOperStatus`) untuk monitoring port.
- **IEEE 802.1AB LLDP MIB:** dasar discovery neighbor Layer 2 / topology.
- **Zabbix documentation — Network discovery & SNMP OID/interface discovery:** pola discovery perangkat, interface, dan SNMP.
- **NetBox documentation — MAC addresses, IPAM, cable/inventory model:** referensi untuk penataan source of truth jaringan dan aset.

Dokumen referensi dipakai sebagai validasi konsep, bukan sebagai ketergantungan vendor. Implementasi harus tetap diuji terhadap MIB/API nyata dari setiap vendor perangkat.
