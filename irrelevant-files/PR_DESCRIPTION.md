# Fix PDF Member Import Issue

## Description
This PR fixes an issue where PDF member imports were incorrectly extracting PDF metadata (like `/Count` and `/Subtype /Type`) instead of actual member data.

## Changes
- Enhanced PDF parsing logic to properly detect and filter metadata
- Improved regex patterns for member name and loan amount extraction
- Added multiple layers of safety checks to ensure no metadata is misinterpreted
- Added support for multiple PDF formats including:
  - NAMELOAN concatenated format (Swawlamban)
  - NAME/LOAN separated sections
  - Tabular formats
- Added comprehensive test coverage

## Testing
- Created comprehensive test scripts to verify all PDF formats
- Verified all fixes against problematic PDFs
- Confirmed no metadata is present in the parsed results

## Screenshots
Before:
```
Imported Members Preview (2 members)
Ready to Create
#	Name	Loan Amount	Email	Phone
1	/Count	₹2.00	-	-
2	/Subtype /Type	₹1.00	-	-
```

After:
```
Imported Members Preview (5 members)
Ready to Create
#	Name	Loan Amount	Email	Phone
1	SANTOSH MISHRA	₹178,604	-	-
2	ASHOK KUMAR KESHRI	₹0	-	-
3	ANUP KUMAR KESHRI	₹2,470,000	-	-
4	PRAMOD KUMAR KESHRI	₹0	-	-
5	MANOJ MISHRA	₹184,168	-	-
```
