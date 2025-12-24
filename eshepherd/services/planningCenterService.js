// Planning Center service
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
   * Perform check-in to Planning Center
   */
  async performCheckIn(user, personIds) {
    if (!user) {
      return { success: false, error: 'You must be signed in to perform check-in.' };
    }
    
    if (!personIds || personIds.length === 0) {
      return { success: false, error: 'Select at least one person to check in.' };
    }
    
    try {
      const idToken = await user.getIdToken();
      const payload = {
        person_ids: personIds,
        email: user.email,
        uid: user.uid
      };
      
      let response;
      try {
        response = await fetch(CHECK_IN_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(payload)
        });
      } catch (fetchError) {
        // Handle network errors (connection lost, timeout, etc.)
        if (fetchError.name === 'TypeError' && (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('Load failed') || fetchError.message.includes('network'))) {
          return { success: false, error: 'Network connection failed. Please check your internet connection and try again.' };
        }
        throw fetchError;
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `Check-in failed: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        return { success: false, error: errorMessage };
      }
      
      const result = await response.json();
      return { success: true, data: result, error: null };
    } catch (error) {
      console.error('Error performing check-in:', error);
      return { success: false, error: error.message || 'An unexpected error occurred during check-in.' };
    }
  }
};

