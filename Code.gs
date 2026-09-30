/**
 * Sunday Hikers — Member Registration Web App
 * Stage 1: Registration (personal details, area/sub-area, address, referrer validation, unique ID)
 *
 * This is a STANDALONE script (not bound to any one spreadsheet) — it works
 * against whichever spreadsheet ID is set in CONFIG.SPREADSHEET_ID below.
 * That means you can build/test against a disposable test sheet now, then
 * switch to the real MasterData sheet later by changing ONE line.
 *
 * SETUP (test phase):
 * 1. Create a fresh Google Sheet for testing. Add a tab named exactly as
 *    CONFIG.SHEET_NAME below, with the header row from COLUMNS (see README).
 * 2. Copy that test sheet's ID from its URL:
 *    https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
 * 3. Go to https://script.google.com → New Project.
 * 4. Replace the default Code.gs content with this file.
 * 5. Paste your test sheet's ID into CONFIG.SPREADSHEET_ID below.
 * 6. Add a new HTML file named "Form" (File → New → HTML file) and paste
 *    Form.html into it.
 * 7. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 * 8. Share the resulting /exec URL to test the flow.
 *
 * SETUP (going live later):
 * 1. Once MasterData has been migrated to this same column structure, just
 *    change CONFIG.SPREADSHEET_ID to MasterData's ID and CONFIG.SHEET_NAME
 *    if needed.
 * 2. Run migrateExistingMembers() ONCE (only if MasterData rows don't yet
 *    have MemberIDs) — safe to re-run, skips rows that already have one.
 * 3. Deploy → Manage deployments → edit the existing deployment → Deploy
 *    (this keeps the same /exec URL live while pointing at new data).
 */

const CONFIG = {
  SPREADSHEET_ID: 'PUT_YOUR_TEST_SHEET_ID_HERE',  // swap to MasterData's ID when going live
  SHEET_NAME: 'MasterData',      // tab name holding member records
  ID_PREFIX: 'SH',
  ID_PAD_LENGTH: 4,               // SH0001, SH0002, ...
};

// Column order for NEW rows written by this script.
// Edit this list if you want different/renamed columns — everything else adapts automatically.
const COLUMNS = [
  'MemberID',
  'Timestamp',
  'ReferralSource',
  'ReferrerName',
  'ReferrerContact',
  'FirstName',
  'LastName',
  'Gender',
  'DOB',
  'ContactNumber',
  'WhatsAppNumber',
  'EmailAddress',
  'OwnsVehicle',
  'DrivesVehicle',
  'AreaGroup',
  'SubArea',
  'Address',
  'EmergencyContactName',
  'EmergencyContactNumber',
  'BloodGroup',
  'ConsentGiven',
];

// Area Group -> Sub-Area options (from the existing form's branching structure)
const AREA_DATA = {
  'Aundh Pimple Gurav area group': ['Medi Point (Aundh)', 'Rohan Nilay (Aundh)', 'Sanewadi (Aundh)', 'Dapodi', 'F.C.Road', 'Khadki', 'Model Colony', 'New Sanghvi', 'Old Sanghvi', 'Pimple Gurav', 'Range Hills', 'Senapati Bapat Road', 'Shivaji Nagar'],
  'Baner Rd area group': ['Balewadi', 'Baner', 'Baner Pashan Link Road (BPLR)', 'Bavdhan', 'Mhalunge', 'Pashan', 'Sus'],
  'Kondhwa Rd area group': ['Gangadham', 'Hadapsar', 'Kondhwa', 'Magarpatta', 'NIBM', 'Salisbury Park', 'Wanawadi'],
  'Nagar Rd area group': ['Kharadi', 'Kalyani Nagar', 'Koregaon Park', 'Viman Nagar', 'Vishrantwadi', 'Wagholi', 'Yerwada', 'Camp', 'Dighi', 'Moshi'],
  'PCMC area group': ['Akurdi', 'Bhosari', 'Chikhali', 'Chinchwad', 'Dehu', 'Jyotibanagar', 'Kasarwadi', 'Nigdi', 'Pimpri', 'Pradhikaran', 'Purna Nagar', 'QueensTown', 'Ravet', 'Shahu Nagar', 'Somatane', 'Talawade', 'Talegaon', 'Thergaon'],
  'Rahatani Wakad area group': ['Dange Chowk', 'Hinjewadi Phase 1', 'Hinjewadi Phase 2', 'Hinjewadi Phase 3', 'Pimple Nilakh', 'Pimple Saudagar', 'Punawale', 'Tathawade', 'Rahatani', 'Vishal Nagar', 'Wakad'],
  'Satara Rd area group': ['Balajinagar', 'Bibwewadi', 'Dhankawdi', 'Katraj', 'Lake town', 'Mukundnagar', 'Padmawati', 'Parvati', 'Peth areas', 'Sahkar Nagar'],
  'Sinhagad Rd Kothrud area group': ['Ambegaon', 'Anand Nahar', 'Bhusari Colony', 'Dattawadi', 'Hingane', 'Karve Nagar', 'Kothrud', 'Malwadi', 'Manik Baug', 'Nanded City', 'Narhe', 'Bhukum, Bhugaon', 'Paud Road', 'Pu La Deshpande Garden', 'Vadgaon', 'Warje', 'Shivane'],
};

const BLOOD_GROUPS = ['A RhD positive (A+)', 'A RhD negative (A-)', 'B RhD positive (B+)', 'B RhD negative (B-)', 'AB RhD positive (AB+)', 'AB RhD negative (AB-)', 'O RhD positive (O+)', 'O RhD negative (O-)'];

const REFERRAL_SOURCES = [
  'Through your friend or relative already part of Sunday Hikers family',
  'Through Sunday Hikers Insta Channel',
  'Through Sunday Hikers YouTube Channel',
  'You happened to meet Sunday Hikers family while trekking',
  'Other',
];

// ---------- Web app entry point ----------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Form')
    .setTitle('Sunday Hikers Member Registration')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- Data helpers exposed to the client ----------

function getFormMeta() {
  return {
    areaData: AREA_DATA,
    bloodGroups: BLOOD_GROUPS,
    referralSources: REFERRAL_SOURCES,
  };
}

/**
 * Called by the client as the user types the referrer's contact number.
 * Returns { valid: true, name: '...' } or { valid: false }.
 */
function checkReferrerContact(contactNumber) {
  const normalized = normalizePhone_(contactNumber);
  if (!normalized) return { valid: false };

  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const contactCol = headers.indexOf('ContactNumber');
  const nameCol = headers.indexOf('FirstName');
  const lastNameCol = headers.indexOf('LastName');
  if (contactCol === -1) return { valid: false };

  for (let i = 1; i < data.length; i++) {
    if (normalizePhone_(data[i][contactCol]) === normalized) {
      const first = lastNameCol > -1 ? data[i][nameCol] : data[i][nameCol];
      const full = (data[i][nameCol] || '') + ' ' + (lastNameCol > -1 ? (data[i][lastNameCol] || '') : '');
      return { valid: true, name: full.trim() };
    }
  }
  return { valid: false };
}

/**
 * Main submission handler, called from the client on form submit.
 * Returns { success: true, memberId: 'SH0007' } or { success: false, error: '...' }.
 */
function submitRegistration(formData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // avoid two simultaneous submissions colliding on ID generation

  try {
    // Server-side re-validation of referrer (never trust client-only checks)
    const referrerCheck = checkReferrerContact(formData.referrerContact);
    if (!referrerCheck.valid) {
      return { success: false, error: 'Referrer contact number was not found in our records. Please double-check with the person who referred you.' };
    }

    const sheet = getSheet_();
    const newId = generateNextMemberId_(sheet);

    const row = COLUMNS.map(col => {
      switch (col) {
        case 'MemberID': return newId;
        case 'Timestamp': return new Date();
        case 'ConsentGiven': return formData.consentGiven ? 'Yes' : 'No';
        default: return formData[col] !== undefined ? formData[col] : '';
      }
    });

    sheet.appendRow(row);
    return { success: true, memberId: newId };

  } catch (err) {
    return { success: false, error: 'Something went wrong: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ---------- One-time migration for existing members ----------

/**
 * Run this ONCE from the Apps Script editor to assign SH#### IDs
 * to rows that don't have one yet. Safe to re-run — it skips rows
 * that already have an ID.
 */
function migrateExistingMembers() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let idCol = headers.indexOf('MemberID');

  if (idCol === -1) {
    sheet.getRange(1, headers.length + 1).setValue('MemberID');
    idCol = headers.length; // 0-indexed position of the new column
  }

  let nextNumber = getHighestIdNumber_(sheet, idCol) + 1;

  for (let i = 1; i < data.length; i++) {
    const currentVal = sheet.getRange(i + 1, idCol + 1).getValue();
    if (!currentVal) {
      const newId = CONFIG.ID_PREFIX + String(nextNumber).padStart(CONFIG.ID_PAD_LENGTH, '0');
      sheet.getRange(i + 1, idCol + 1).setValue(newId);
      nextNumber++;
    }
  }

  Logger.log('Migration complete. Existing members now have MemberIDs. Check the "Executions" tab (left sidebar) or View > Logs for details.');
}

// ---------- Internal helpers ----------

function getSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" not found.');
  return sheet;
}

function generateNextMemberId_(sheet) {
  const idCol = sheet.getDataRange().getValues()[0].indexOf('MemberID');
  const nextNumber = getHighestIdNumber_(sheet, idCol) + 1;
  return CONFIG.ID_PREFIX + String(nextNumber).padStart(CONFIG.ID_PAD_LENGTH, '0');
}

function getHighestIdNumber_(sheet, idCol) {
  if (idCol === -1) return 0;
  const values = sheet.getRange(2, idCol + 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  let max = 0;
  values.forEach(row => {
    const val = String(row[0] || '');
    const match = val.match(/(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return max;
}

function normalizePhone_(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10); // last 10 digits, ignore +91/spaces/dashes
}
