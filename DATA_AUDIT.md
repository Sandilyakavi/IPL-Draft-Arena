# IPL Draft Arena — DATA AUDIT REPORT

**Audit Date:** August 10, 2026  
**Target Dataset:** `src/data/players.json` (216 player records across 10 IPL 2026 franchises)  
**Primary Verification Source:** Official IPL 2025/2026 Mega Auction & Retention Database (iplt20.com, ESPNcricinfo, Official Franchise Releases)

---

## Executive Summary

A comprehensive factual data audit was conducted across all 10 IPL franchises in `src/data/players.json`. Beyond structural integrity checks, every player record was cross-referenced against official IPL mega auction rosters and retention releases to verify factual accuracy, team assignments, roles, nationalities, overseas statuses, and wicketkeeper flags.

### Audit Summary Table

| Franchise | Official Squad Count | Dataset Squad Count | Missing Players | Extra Players | Team Assignment Corrections | Role / Flag Corrections | Verification Source | Audit Result |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **CSK** (Chennai Super Kings) | 23 | 23 | None | None | 1 (Deepak Chahar moved to MI) | None | Official IPL Auction Data & CSK Release | **PASS WITH CORRECTIONS** |
| **DC** (Delhi Capitals) | 22 | 22 | None | None | None | None | Official IPL Auction Data & DC Release | **PASS** |
| **GT** (Gujarat Titans) | 23 | 23 | None | None | None | None | Official IPL Auction Data & GT Release | **PASS** |
| **KKR** (Kolkata Knight Riders) | 21 | 21 | None | None | None | None | Official IPL Auction Data & KKR Release | **PASS** |
| **LSG** (Lucknow Super Giants) | 21 | 21 | None | None | 1 (Akash Madhwal moved to RR) | None | Official IPL Auction Data & LSG Release | **PASS WITH CORRECTIONS** |
| **MI** (Mumbai Indians) | 22 | 22 | None | None | +1 (Deepak Chahar received from CSK) | None | Official IPL Auction Data & MI Release | **PASS WITH CORRECTIONS** |
| **PBKS** (Punjab Kings) | 22 | 22 | None | None | None | None | Official IPL Auction Data & PBKS Release | **PASS** |
| **RR** (Rajasthan Royals) | 20 | 20 | None | None | +1 (Akash Madhwal received from LSG) | None | Official IPL Auction Data & RR Release | **PASS WITH CORRECTIONS** |
| **RCB** (Royal Challengers B'luru) | 22 | 22 | None | None | None | None | Official IPL Auction Data & RCB Release | **PASS** |
| **SRH** (Sunrisers Hyderabad) | 20 | 20 | None | None | None | None | Official IPL Auction Data & SRH Release | **PASS** |

---

## Detailed Audit Breakdown by Franchise

### 1. Chennai Super Kings (CSK)
- **Official Squad Player Count:** 23
- **Dataset Player Count:** 23
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** 
  - `deepak-chahar` (Deepak Chahar): Previously placed in CSK. **Corrected to MI** (Acquired by Mumbai Indians for ₹9.25 crore in the mega auction).
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & ESPNcricinfo
- **Status:** **PASS WITH CORRECTIONS**

### 2. Delhi Capitals (DC)
- **Official Squad Player Count:** 22
- **Dataset Player Count:** 22
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** None
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & DC Official Release
- **Status:** **PASS**

### 3. Gujarat Titans (GT)
- **Official Squad Player Count:** 23
- **Dataset Player Count:** 23
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** None
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & GT Official Release
- **Status:** **PASS**

### 4. Kolkata Knight Riders (KKR)
- **Official Squad Player Count:** 21
- **Dataset Player Count:** 21
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** None
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & KKR Official Release
- **Status:** **PASS**

### 5. Lucknow Super Giants (LSG)
- **Official Squad Player Count:** 21
- **Dataset Player Count:** 21
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:**
  - `akash-madhwal` (Akash Madhwal): Previously placed in LSG. **Corrected to RR** (Acquired by Rajasthan Royals for ₹1.20 crore in the mega auction).
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & LSG Official Release
- **Status:** **PASS WITH CORRECTIONS**

### 6. Mumbai Indians (MI)
- **Official Squad Player Count:** 22
- **Dataset Player Count:** 22
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:**
  - `deepak-chahar` (Deepak Chahar): Added to MI from CSK (Acquired for ₹9.25 crore).
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & MI Official Release
- **Status:** **PASS WITH CORRECTIONS**

### 7. Punjab Kings (PBKS)
- **Official Squad Player Count:** 22
- **Dataset Player Count:** 22
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** None
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & PBKS Official Release
- **Status:** **PASS**

### 8. Rajasthan Royals (RR)
- **Official Squad Player Count:** 20
- **Dataset Player Count:** 20
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:**
  - `akash-madhwal` (Akash Madhwal): Added to RR from LSG (Acquired for ₹1.20 crore).
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & RR Official Release
- **Status:** **PASS WITH CORRECTIONS**

### 9. Royal Challengers Bengaluru (RCB)
- **Official Squad Player Count:** 22
- **Dataset Player Count:** 22
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** None
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & RCB Official Release
- **Status:** **PASS**

### 10. Sunrisers Hyderabad (SRH)
- **Official Squad Player Count:** 20
- **Dataset Player Count:** 20
- **Missing Players:** None
- **Extra Players:** None
- **Incorrect Team Assignments:** None
- **Role Corrections:** None
- **Nationality Corrections:** None
- **Overseas Corrections:** None
- **Wicketkeeper Corrections:** None
- **Source Used:** Official IPL 2025/2026 Auction Registry & SRH Official Release
- **Status:** **PASS**

---

## Specific Audit Verification Checks

1. **Role Enum Verification:** Every player record adheres strictly to one of four allowed role strings: `"batter"`, `"wicketkeeper-batter"`, `"all-rounder"`, `"bowler"`.
2. **Wicketkeeper Status:** All 28 designated wicketkeeper-batters have `isWicketkeeper: true` and `role: "wicketkeeper-batter"`.
3. **Overseas Consistency:** All 69 overseas players have `isOverseas: true` and nationality != `'IND'`. All 147 Indian players have `isOverseas: false` and `nationality: "IND"`.
4. **Outdated 2025 Roster Check:** Verified that no old 2024/2025 pre-auction roster assignments remain. Transferred players (KL Rahul to DC, Rishabh Pant to LSG, Shreyas Iyer to PBKS, Jos Buttler to GT, Mohammed Siraj to GT, Yuzvendra Chahal to PBKS, Mitchell Starc to DC, Deepak Chahar to MI, Akash Madhwal to RR) match their official current franchise.

---

## DATA AUDIT STATUS

### **PASS WITH CORRECTIONS**
