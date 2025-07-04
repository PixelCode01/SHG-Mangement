# Group Form Fixes - Summary

## Issues Fixed:

### 1. Collection Frequency Conditional Fields
**Problem**: Collection frequency conditional fields were not working properly in the frontend.

**Solution**: 
- Made `collectionFrequency` required in the schema instead of optional
- Added conditional validation using `superRefine` to validate required fields based on selected frequency:
  - **Monthly**: Requires `collectionDayOfMonth` (1-31)
  - **Weekly**: Requires `collectionDayOfWeek` (Monday-Sunday) 
  - **Fortnightly**: Requires `collectionDayOfWeek` AND `collectionWeekOfMonth` (1st/3rd or 2nd/4th weeks)
  - **Yearly**: Requires `collectionMonth` (1-12) AND `collectionDate` (1-31)

### 2. Form Reactivity Issues
**Problem**: Conditional fields weren't updating properly when collection frequency changed.

**Solution**:
- Replaced `watch()` function calls with `useWatch` hooks for better performance and reactivity
- Added `useEffect` to clear irrelevant fields when collection frequency changes
- Updated all conditional rendering to use the new watched variables

### 3. Late Fine Rules
**Problem**: Late fine configuration needed proper conditional validation.

**Solution**:
- Added validation for late fine rule configuration when enabled
- Validates rule type selection and corresponding fields:
  - **DAILY_FIXED**: Requires `dailyAmount`
  - **DAILY_PERCENTAGE**: Requires `dailyPercentage`
  - **TIER_BASED**: Shows tier configuration options

## Technical Changes Made:

1. **Schema Updates**:
   ```typescript
   // Made collection frequency required
   collectionFrequency: collectionFrequencyEnum,
   
   // Added superRefine for conditional validation
   }).superRefine((data, ctx) => {
     // Validation logic for each frequency type
   });
   ```

2. **Form State Management**:
   ```typescript
   // Replaced watch() with useWatch hooks
   const collectionFrequency = useWatch({ control, name: 'collectionFrequency' });
   const lateFineEnabled = useWatch({ control, name: 'lateFineRule.isEnabled' });
   const lateFineRuleType = useWatch({ control, name: 'lateFineRule.ruleType' });
   ```

3. **Field Clearing Logic**:
   ```typescript
   // Clear irrelevant fields when frequency changes
   useEffect(() => {
     if (collectionFrequency) {
       setValue('collectionDayOfMonth', undefined, { shouldValidate: false });
       setValue('collectionDayOfWeek', undefined, { shouldValidate: false });
       setValue('collectionWeekOfMonth', undefined, { shouldValidate: false });
       setValue('collectionMonth', undefined, { shouldValidate: false });
       setValue('collectionDate', undefined, { shouldValidate: false });
     }
   }, [collectionFrequency, setValue]);
   ```

4. **Conditional Rendering Updates**:
   ```typescript
   // Updated all conditional rendering to use watched variables
   {collectionFrequency === 'MONTHLY' && (
     // Monthly fields
   )}
   {collectionFrequency === 'WEEKLY' && (
     // Weekly fields  
   )}
   // etc.
   ```

## Expected Behavior Now:

1. ✅ **Collection Frequency**: Required field with default value 'MONTHLY'
2. ✅ **Monthly**: Shows day of month selector (1-31)
3. ✅ **Weekly**: Shows day of week selector (Monday-Sunday)
4. ✅ **Fortnightly**: Shows day of week + week pattern selector
5. ✅ **Yearly**: Shows month selector + date selector
6. ✅ **Late Fine**: Shows configuration options when enabled
7. ✅ **Validation**: Proper error messages for missing required fields
8. ✅ **Form Reset**: Clears irrelevant fields when frequency changes

## User Experience:

- Form now properly validates conditional fields based on collection frequency
- Users see immediate feedback when selecting different frequencies
- Late fine rules show proper configuration options when enabled
- All fields clear appropriately when switching between frequencies
- Form submission validates all required fields based on current selections
