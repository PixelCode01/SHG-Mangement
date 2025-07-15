/**
 * Test page for Custom Columns Manager
 */

'use client';

import React, { useState } from 'react';
import { CustomColumnsManager } from '@/app/components/CustomColumnsManager';
import { GroupCustomSchema } from '@/app/types/custom-columns';

export default function TestCustomColumnsPage() {
  const [currentSchema, setCurrentSchema] = useState<GroupCustomSchema | undefined>();

  const handleSchemaChange = (schema: GroupCustomSchema) => {
    console.log('Schema changed:', schema);
    setCurrentSchema(schema);
  };

  const handleSave = async (schema: GroupCustomSchema) => {
    console.log('Saving schema:', schema);
    // Simulate async save
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Schema saved successfully');
  };

  const handleCancel = () => {
    console.log('Operation cancelled');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <CustomColumnsManager
          groupId="test-group"
          groupName="Test Group"
          {...(currentSchema && { currentSchema })}
          onSchemaChange={handleSchemaChange}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
