// Utility functions for household management

/**
 * Get household members for a person
 */
export function getHouseholdMembers(person, planningCentrePeople) {
  if (!person || !person.household_ids || !Array.isArray(person.household_ids) || person.household_ids.length === 0) {
    return [];
  }
  
  // Find all people who share the same household_ids
  const householdMembers = planningCentrePeople.filter(p => {
    if (!p.household_ids || !Array.isArray(p.household_ids)) return false;
    // Check if they share any household_ids
    return p.id !== person.id && p.household_ids.some(hid => person.household_ids.includes(hid));
  });
  
  return householdMembers;
}

/**
 * Get household groups (grouped by household_id)
 */
export function getHouseholdGroups(person, planningCentrePeople) {
  if (!person || !person.household_ids || !Array.isArray(person.household_ids) || person.household_ids.length === 0) {
    return [];
  }
  
  // Group people by each household_id
  const groups = person.household_ids.map(householdId => {
    // Find all people who share this specific household_id, excluding the selected person
    const members = planningCentrePeople.filter(p => {
      if (!p.household_ids || !Array.isArray(p.household_ids)) return false;
      // Exclude the selected person from household members
      return p.id !== person.id && p.household_ids.includes(householdId);
    });
    
    return {
      householdId: householdId,
      members: members
    };
  });
  
  return groups;
}

/**
 * Get household members display string (truncated if too long)
 */
export function getHouseholdMembersDisplay(person, planningCentrePeople) {
  const members = getHouseholdMembers(person, planningCentrePeople);
  if (members.length === 0) return '';
  
  // Get names of household members
  const names = members.map(m => m.name).filter(name => name);
  
  // Truncate if too long (roughly estimate based on character count)
  const maxLength = 50; // Approximate max characters to fit in dropdown
  let display = names.join(', ');
  
  if (display.length > maxLength) {
    // Truncate and add ellipsis
    let truncated = '';
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const separator = truncated ? ', ' : '';
      if ((truncated + separator + name).length > maxLength - 3) {
        // Leave room for '...'
        truncated += '...';
        break;
      }
      truncated += separator + name;
    }
    display = truncated;
  }
  
  return display;
}

