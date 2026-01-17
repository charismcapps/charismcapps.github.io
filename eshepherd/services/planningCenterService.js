// Planning Center service
import { database } from '../config/firebase.js';

const PLANNING_CENTER_PEOPLE_API = 'https://get-planning-centre-people-g7egpip7ea-as.a.run.app';
const CHECK_IN_API = 'https://check-in-to-planning-center-g7egpip7ea-as.a.run.app';

export const planningCenterService = {
  /**
   * Fetch people from Planning Center
   */
  async fetchPeople(user) {
    if (!user) {
      console.error('User not authenticated');
      return { records: [], error: 'User not authenticated' };
    }
    
    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch(PLANNING_CENTER_PEOPLE_API, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch planning centre people: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Planning centre people response:', data);
      
      // Handle different response structures and extract the records array
      let records = [];
      if (Array.isArray(data)) {
        records = data;
      } else if (data && Array.isArray(data.people)) {
        records = data.people;
      } else if (data && Array.isArray(data.data)) {
        records = data.data;
      } else if (data && typeof data === 'object') {
        // If it's an object, try to find any array property
        const arrayKeys = Object.keys(data).filter(key => Array.isArray(data[key]));
        if (arrayKeys.length > 0) {
          records = data[arrayKeys[0]];
        }
      }
      
      return { records, error: null };
    } catch (error) {
      console.error('Error fetching planning centre people:', error);
      return { records: [], error: error.message };
    }
  },

  /**
   * Perform check-in to Planning Center (non-blocking, fire and forget)
   */
  performCheckIn(user, personIds) {
    if (!user) {
      return { success: false, error: 'You must be signed in to perform check-in.' };
    }
    
    if (!personIds || personIds.length === 0) {
      return { success: false, error: 'Select at least one person to check in.' };
    }
    
    // Fire and forget - don't wait for response
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const payload = {
          person_ids: personIds,
          email: user.email,
          uid: user.uid
        };
        
        // Make the API call without waiting for response
        fetch(CHECK_IN_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(payload)
        }).catch(error => {
          console.error('Error performing check-in (background):', error);
        });
      } catch (error) {
        console.error('Error performing check-in (background):', error);
      }
    })();
    
    // Return immediately
    return { success: true, error: null };
  },

  /**
   * Get current checkin status from Firebase
   */
  async getCurrentCheckInStatus() {
    try {
      if (!database) {
        return null;
      }
      const checkinRef = database.ref('eshepherd/checkin/current');
      const snapshot = await checkinRef.once('value');
      return snapshot.val();
    } catch (error) {
      console.error('Error getting current checkin status:', error);
      return null;
    }
  },

  /**
   * Get last checkin status from Firebase
   */
  async getLastCheckInStatus() {
    try {
      if (!database) {
        return null;
      }
      const checkinRef = database.ref('eshepherd/checkin/last');
      const snapshot = await checkinRef.once('value');
      return snapshot.val();
    } catch (error) {
      console.error('Error getting last checkin status:', error);
      return null;
    }
  },

  /**
   * Subscribe to checkin status changes
   */
  subscribeToCheckInStatus(callback) {
    if (!database) {
      return () => {}; // Return no-op unsubscribe function
    }
    
    const currentRef = database.ref('eshepherd/checkin/current');
    const lastRef = database.ref('eshepherd/checkin/last');
    
    let currentStatus = null;
    let lastStatus = null;
    
    const updateCallback = () => {
      callback({ current: currentStatus, last: lastStatus });
    };
    
    const currentCallback = (snapshot) => {
      currentStatus = snapshot.val();
      updateCallback();
    };
    
    const lastCallback = (snapshot) => {
      lastStatus = snapshot.val();
      updateCallback();
    };
    
    // Load initial values
    currentRef.once('value', currentCallback);
    lastRef.once('value', lastCallback);
    
    // Subscribe to changes
    currentRef.on('value', currentCallback);
    lastRef.on('value', lastCallback);
    
    // Return unsubscribe function
    return () => {
      currentRef.off('value', currentCallback);
      lastRef.off('value', lastCallback);
    };
  },

  /**
   * Get household members for a person
   */
  getHouseholdMembers(person, planningCentrePeople) {
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
  },

  /**
   * Get household groups (grouped by household_id)
   */
  getHouseholdGroups(person, planningCentrePeople) {
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
  },

  /**
   * Get household members display string (truncated if too long)
   */
  getHouseholdMembersDisplay(person, planningCentrePeople) {
    const members = this.getHouseholdMembers(person, planningCentrePeople);
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
  },

  /**
   * Get person by ID from planning centre people
   */
  getPersonById(personId, planningCentrePeople) {
    if (!personId || !planningCentrePeople) return null;
    return planningCentrePeople.find(p => p.id === personId) || null;
  }
};

