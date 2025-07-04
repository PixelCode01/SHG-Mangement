# Member Import Feature

## Overview
The SHG Management application now includes a member import feature that allows you to import members from CSV, Excel, or PDF files before setting up your group.

## How It Works

### Step 1: Basic Information
Fill out the basic group information as usual.

### Step 2: Import Members (NEW - Optional)
This new step allows you to import members from external files.

#### Supported File Formats:
- **CSV** (.csv)
- **Excel** (.xlsx, .xls)
- **PDF** (.pdf)

#### Required Columns:
- **Name** (required) - Member's full name
- **Loan Amount** (required) - Initial loan amount for the member

#### Optional Columns:
- **Email** (optional) - Member's email address
- **Phone** (optional) - Member's phone number

#### Sample File Formats:

**CSV Format:**
```csv
Name,Loan Amount,Email,Phone
John Doe,5000,john.doe@example.com,+1234567890
Jane Smith,7500,jane.smith@example.com,+1234567891
Bob Johnson,10000,,+1234567892
```

**Excel Format:**
Same structure as CSV but in Excel format (.xlsx or .xls)

**PDF Format:**
Should contain a table with the same column structure. The system will attempt to parse tabular data from the PDF. When importing any file format, you'll see a visual animation showing the multi-step processing of the document. The system can identify tables in various PDF formats, including:

```
Example Table Format 1:
ID  Name            Loan Amount  Email               Phone
1   John Doe        Rs. 5000     john@example.com    +1234567890
2   Jane Smith      Rs. 7500     jane@example.com    +1234567891
```

```
Example Table Format 2:
SL  MEMBER NAME     AMOUNT
1   RAJESH KUMAR    4800
2   SANTOSH MISHRA  5200
```

```
Example Table Format 3 (Separated columns/values):
NAME                                       LOAN
178604
0
2470000
0
184168
SANTOSH MISHRA             
ASHOK KUMAR KESHRI    
```

```
Example Table Format 4 (Irregular spacing):
NAME                                   LOAN
SANTOSH MISHRA            89000
ASHOK KUMAR KESHRI   9999
```

### How to Use:

1. **Navigate to Step 2** after completing basic information
2. **Click "Import Members from File"** to show the upload interface
3. **Select your file** (CSV, Excel, or PDF)
4. **Review the parsed data** - The system will show you what it found:
   - Valid members with their loan amounts
   - Any errors or missing required fields
5. **Click "Create These Members"** to add them to your system
6. **Proceed to Step 3** to select members and assign leadership

### Features:

- **Automatic validation** - Ensures required fields are present
- **Error reporting** - Shows which rows have issues
- **Preview before creation** - Review all imported data before creating members
- **Automatic member selection** - Imported members are automatically added to your group
- **Loan amount pre-filling** - The loan amounts from your import file are automatically set

### File Import Animation

When importing members from any file format (CSV, Excel, or PDF), the system provides a visual feedback experience:

1. **Loading Indicator**: Shows that the document is being processed
2. **Processing Stages**: Displays the current stage of file analysis:
   - Loading document
   - Analyzing file structure
   - Extracting member data
   - Validating data format
   - Preparing results
3. **Progress Animation**: Visual feedback with document scanning animation and progress bar
4. **Stage Indicators**: Clear labels showing the current processing stage

The animation will appear for all file imports and automatically cycle through the processing stages. This animation helps provide visual feedback and transparency about the file processing steps, particularly for complex PDFs or large data files.

If no valid member data can be found in the file, a clear error message will be displayed to help you troubleshoot the issue, but you'll still see the complete animation sequence first.

The PDF import uses advanced text extraction to identify tables and structured data in your documents. The animation helps provide transparency into this complex process, especially for large PDF files.

#### Tips for PDF Import:

- Use PDFs with clearly defined tables
- Ensure column headers include "Name" and "Loan Amount" (or similar variations)
- Tables with clear column separation work best
- The system can handle various PDF formatting styles including:
  - Standard table formats with column headers
  - Simple spaced tabular data
  - Tables with or without grid lines
  - Different currency formats (Rs., ₹, INR, etc.)
  - Special formats with NAME/LOAN headers where data appears on separate lines
  - Formats where names and amounts are not perfectly aligned
- PDF extraction works best with text-based PDFs rather than scanned documents

### Sample Files:
- `sample-members.csv` - Sample CSV file
- `sample-members.xlsx` - Sample Excel file
- `sample-members.pdf` - Sample PDF file with structured member data
- `sample-members-alt.pdf` - Sample PDF file with alternative table format
- `sample-members-special.pdf` - Sample PDF file with names and amounts on separate lines
- `sample-members-irregular.pdf` - Sample PDF file with irregular spacing between names and amounts

### Step 3: Select Members & Group Setup
Now enhanced with your imported members, plus the ability to manually create additional members.

### Step 4: Financial Data (Optional)
Historical financial data input for groups with past start dates.

## Error Handling and Validation

The system will:
- Skip rows with missing required fields (Name or Loan Amount)
- Skip members that already exist in the system (including existing leaders)
- Show detailed error messages for invalid data
- Display information about skipped existing members
- Allow you to fix and re-upload files
- Continue with valid rows even if some rows have issues

## Benefits

1. **Bulk member creation** - No need to create members one by one
2. **Data consistency** - Import from existing spreadsheets or databases
3. **Time saving** - Faster group setup process
4. **Flexible formats** - Support for multiple file types
5. **Error prevention** - Validation ensures data quality
