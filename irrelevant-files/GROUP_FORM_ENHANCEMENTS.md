# Group Form Enhancements

## Collection Frequency Conditional Fields

The group form now shows different collection schedule fields based on the selected collection frequency:

### Monthly Collection
- **Field**: Day of Month (1-31)
- **Description**: Choose which day of the month to collect contributions (e.g., 8th of every month)

### Weekly Collection
- **Field**: Day of Week (Monday-Sunday)  
- **Description**: Choose which day of the week to collect contributions

### Fortnightly Collection (Every 2 weeks)
- **Field 1**: Day of Week (Monday-Sunday)
- **Field 2**: Collection Pattern 
  - Option 1: 1st and 3rd weeks of every month
  - Option 2: 2nd and 4th weeks of every month
- **Description**: Choose day of week and which weeks to collect contributions every 2 weeks

### Yearly Collection
- **Field 1**: Collection Month (January-December)
- **Field 2**: Collection Date (1-31)
- **Description**: Choose the month and date for yearly contribution collection (e.g., January 15th of every year)

## Late Fine System

### Enable Late Fine
- **Checkbox**: "Enable Late Fine System"
- When checked, reveals late fine configuration options

### Late Fine Rule Types

#### 1. Fixed Amount Per Day
- **Description**: Fixed amount per day (e.g., ₹10 every day)
- **Field**: Daily Fine Amount (₹)
- **Default**: ₹10 when selected
- **Example**: ₹10 charged for every day a payment is late

#### 2. Percentage of Contribution Per Day
- **Description**: Percentage of contribution per day (e.g., 1% daily)
- **Field**: Daily Fine Percentage (%)
- **Default**: 1% when selected
- **Range**: 0-100%
- **Example**: 1% of the contribution amount charged per day

#### 3. Tier-Based Rules
- **Description**: Different amounts for different delay periods
- **Configuration**: Up to 3 configurable tiers with:
  - Days From (start day)
  - Days To (end day)  
  - Fine Amount (₹)
  - Is Percentage checkbox
- **Default Tiers**:
  - Tier 1: Days 1-5, ₹10 per day
  - Tier 2: Days 6-15, ₹25 per day  
  - Tier 3: Days 16+, ₹50 per day

## Form Validation

### Collection Frequency Validation
- Monthly: Requires day of month (1-31)
- Weekly: Requires day of week
- Fortnightly: Requires day of week AND collection pattern
- Yearly: Requires month AND date

### Late Fine Validation
- When late fine is enabled, rule type is required
- Daily Fixed: Requires daily amount
- Daily Percentage: Requires daily percentage (0-100%)
- Tier-Based: Validates tier configurations including:
  - Start day, end day, and amount are required for each tier
  - Start day must be ≤ end day
  - At least one tier required

## Auto-Population Features

### Default Values
- Collection Frequency: Defaults to "Monthly"
- Late Fine Rule Type: Auto-selects "Fixed Amount" when late fine is enabled
- Daily Fixed Amount: Auto-sets to ₹10
- Daily Percentage: Auto-sets to 1%
- Tier Rules: Pre-populated with sensible defaults

### Smart Field Management
- Fields automatically clear when collection frequency changes
- Late fine rule fields clear when rule type changes
- Helpful default values are set when options are selected

## User Experience Improvements

### Better Descriptions
- Clear explanations for each collection frequency option
- Helpful placeholder text and examples
- Color-coded information boxes with configuration examples
- Visual indicators for required fields

### Form Flow
- Conditional fields only show when relevant
- Smart defaults reduce user input requirements
- Validation messages guide users to correct configuration
- Auto-focus and field management for smooth UX

## Technical Implementation

### Technologies Used
- React Hook Form with Zod validation
- TypeScript for type safety
- Conditional rendering based on form state
- useWatch hooks for reactive form updates
- Comprehensive form validation with custom error messages

### Form State Management
- Automatic field clearing when dependencies change
- Default value population for better UX
- Real-time validation feedback
- Proper form submission handling with structured data

This enhancement provides a comprehensive collection scheduling and late fine management system that adapts to different group operational needs while maintaining data integrity and user-friendly interactions.
