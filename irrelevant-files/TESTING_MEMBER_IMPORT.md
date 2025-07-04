# Testing the Member Import Feature

Follow these steps to test the newly implemented member import functionality:

## Prerequisites
- Make sure the development server is running:
  ```bash
  npm run dev
  ```
- Navigate to http://localhost:3000/groups/create (or your SHG Management application URL)

## Test Cases

### Test Case 1: Basic CSV Import
1. Navigate through Step 1 to fill in basic group information
2. On Step 2 (Import Members), click "Import Members from File"
3. Upload the provided `sample-members.csv` file
4. Verify:
   - Members are shown in the preview table
   - Proper count of members is displayed
   - Member data (name, loan amount, email, phone) is correctly parsed
   - The "Skip & Use Existing Members" button is visible
   - If any members already exist in your system, they are listed as skipped

### Test Case 2: Excel Import
1. Navigate through Step 1 to fill in basic group information
2. On Step 2 (Import Members), click "Import Members from File"
3. Upload the provided `sample-members.xlsx` file
4. Verify:
   - Excel data is properly parsed
   - The same validations occur as with CSV

### Test Case 3: Validation and Error Handling
1. Create a member (e.g. "Leader Example") manually first
2. Then attempt to import the sample files which contain the same name
3. Verify:
   - The import correctly identifies and skips the existing member
   - Error messages properly indicate which members were skipped
   - The import still proceeds with valid new members

### Test Case 4: Skip & Continue
1. On Step 2, without importing any members, click "Skip & Use Existing Members" 
2. Verify:
   - The form proceeds to Step 3 without errors
   - You can select existing members as before

### Test Case 5: Member Creation and Selection
1. Import valid members
2. Click "Create These Members"
3. Verify:
   - Success message about member creation
   - Proceed to Step 3
   - Newly imported members appear in the member selection list
   - Loan amounts from import are preserved

## If You Encounter Issues
- Check browser console for any JavaScript errors
- Verify that your CSV/Excel columns match the expected format
- Try with smaller imports first to isolate any issues
- If XLSX library issues occur, try refreshing/restarting the server

## Expected Behavior
1. When members already exist in the system, they are skipped and noted in status messages
2. Leader members can still be manually selected in Step 3
3. Newly created members automatically appear in the member selection list
4. Member loan amounts from import should be automatically applied
