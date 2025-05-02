import axios from 'axios';

// Base URLs for the RxNorm and NLM Drug Interaction APIs
const RXNORM_API_BASE_URL = 'https://rxnav.nlm.nih.gov/REST/rxcui';
const DRUG_INTERACTION_API_BASE_URL = 'https://rxnav.nlm.nih.gov/REST/interaction';
const RXNORM_SUGGESTIONS_API_URL = 'https://rxnav.nlm.nih.gov/REST/spellingsuggestions';
const RXNORM_APPROX_MATCH_API_URL = 'https://rxnav.nlm.nih.gov/REST/approximateTerm';

/**
 * Gets RxNorm ID (RxCUI) for a given medication name
 */
export async function getRxCuiByName(name: string): Promise<{ success: boolean; rxcui?: string; message?: string }> {
  try {
    console.log(`Fetching RxCUI for medication: ${name}`);
    const response = await axios.get(`${RXNORM_API_BASE_URL}.json`, {
      params: {
        name
      }
    });

    console.log('RxCUI API response:', JSON.stringify(response.data, null, 2));

    if (response.data.idGroup && response.data.idGroup.rxnormId && response.data.idGroup.rxnormId.length > 0) {
      const rxcui = response.data.idGroup.rxnormId[0];
      console.log(`Found RxCUI: ${rxcui} for medication: ${name}`);
      return {
        success: true,
        rxcui
      };
    }

    console.log(`No RxCUI found for medication: ${name}`);
    return {
      success: false,
      message: 'No RxCUI found for the medication'
    };
  } catch (error) {
    console.error('Error getting RxCUI:', error);
    return {
      success: false,
      message: 'Error getting medication information'
    };
  }
}

/**
 * Gets medication name suggestions based on a partial name
 */
export async function getMedicationNameSuggestions(partialName: string): Promise<string[]> {
  try {
    // First try to get suggestions using the spelling suggestions API
    const spellingResponse = await axios.get(`${RXNORM_SUGGESTIONS_API_URL}.json`, {
      params: {
        name: partialName
      }
    });

    if (spellingResponse.data.suggestionGroup.suggestionList?.suggestion?.length > 0) {
      return spellingResponse.data.suggestionGroup.suggestionList.suggestion;
    }

    // If no spelling suggestions, try approximate match
    const approxResponse = await axios.get(`${RXNORM_APPROX_MATCH_API_URL}.json`, {
      params: {
        term: partialName,
        maxEntries: 10
      }
    });

    if (approxResponse.data.approximateGroup.candidate?.length > 0) {
      return approxResponse.data.approximateGroup.candidate;
    }

    return [];
  } catch (error) {
    console.error('Error getting medication name suggestions:', error);
    return [];
  }
}

/**
 * Gets medication information by its RxCUI
 */
export async function getMedicationInfoByRxCui(rxcui: string): Promise<any> {
  try {
    const response = await axios.get(`${RXNORM_API_BASE_URL}/${rxcui}/allrelated.json`);
    
    if (response.data.allRelatedGroup?.conceptGroup) {
      return {
        success: true,
        info: response.data.allRelatedGroup.conceptGroup
      };
    }
    
    return {
      success: false,
      message: 'No information found for the medication'
    };
  } catch (error) {
    console.error('Error getting medication information:', error);
    return {
      success: false,
      message: 'Error getting medication information'
    };
  }
}

/**
 * Checks for interactions between multiple medications using medication names
 */
export async function checkDrugInteractionsByNames(medicationNames: string[]): Promise<any> {
  try {
    if (!medicationNames || medicationNames.length < 2) {
      console.log('Not enough medications to check for interactions');
      return {
        success: true,
        interactions: []
      };
    }

    console.log(`Checking interactions for medications: ${medicationNames.join(', ')}`);
    
    // First, get the RxCUIs for each medication
    const rxcuiPromises = medicationNames.map(name => getRxCuiByName(name));
    const rxcuiResults = await Promise.all(rxcuiPromises);
    
    // Filter out medications for which we couldn't find RxCUIs
    const validRxcuis = rxcuiResults
      .filter(result => result.success && result.rxcui)
      .map(result => result.rxcui as string);
    
    const nameToRxcui = new Map<string, string>();
    medicationNames.forEach((name, index) => {
      if (rxcuiResults[index].success && rxcuiResults[index].rxcui) {
        nameToRxcui.set(name.toLowerCase(), rxcuiResults[index].rxcui as string);
      }
    });
    
    console.log(`Found valid RxCUIs: ${validRxcuis.join(', ')}`);
    
    if (validRxcuis.length < 2) {
      console.log('Not enough valid RxCUIs to check for interactions');
      return {
        success: true,
        interactions: []
      };
    }
    
    // Now check for interactions using the RxCUIs
    return await checkDrugInteractions(validRxcuis, nameToRxcui);
  } catch (error) {
    console.error('Error checking drug interactions by names:', error);
    return {
      success: false,
      message: 'Error checking drug interactions'
    };
  }
}

/**
 * Checks for interactions between multiple medications using RxCUIs
 */
export async function checkDrugInteractions(
  rxcuiList: string[], 
  nameToRxcui?: Map<string, string>
): Promise<any> {
  try {
    if (!rxcuiList || rxcuiList.length < 2) {
      return {
        success: true,
        interactions: []
      };
    }

    console.log(`Requesting interactions for RxCUIs: ${rxcuiList.join('+')}`);
    
    const response = await axios.get(`${DRUG_INTERACTION_API_BASE_URL}/list.json`, {
      params: {
        rxcuis: rxcuiList.join('+')
      }
    });
    
    console.log('Drug interaction API response:', JSON.stringify(response.data, null, 2));

    // Create a map from RxCUI back to the original medication name if provided
    const rxcuiToName = new Map<string, string>();
    if (nameToRxcui) {
      // Convert entries to array before iteration to avoid TypeScript error
      Array.from(nameToRxcui.entries()).forEach(([name, rxcui]) => {
        rxcuiToName.set(rxcui, name);
      });
    }

    if (response.data.fullInteractionTypeGroup) {
      // Extract detailed interactions
      const interactionGroup = response.data.fullInteractionTypeGroup.find(
        (g: any) => g.sourceName === 'DrugBank'
      ) || response.data.fullInteractionTypeGroup[0];

      if (interactionGroup && interactionGroup.fullInteractionType) {
        const interactions = interactionGroup.fullInteractionType.map((interaction: any) => {
          let drug1 = interaction.minConcept[0].name;
          let drug2 = interaction.minConcept[1].name;
          
          // If we have the original names, use those instead
          if (rxcuiToName) {
            const rxcui1 = interaction.minConcept[0].rxcui;
            const rxcui2 = interaction.minConcept[1].rxcui;
            
            if (rxcuiToName.has(rxcui1)) {
              drug1 = rxcuiToName.get(rxcui1) || drug1;
            }
            
            if (rxcuiToName.has(rxcui2)) {
              drug2 = rxcuiToName.get(rxcui2) || drug2;
            }
          }
          
          const description = interaction.description;
          const severity = getSeverityFromDescription(description);

          return {
            drug1,
            drug2,
            description,
            severity
          };
        });

        console.log(`Found ${interactions.length} interactions`);
        return {
          success: true,
          interactions
        };
      }
    }

    console.log('No interactions found');
    return {
      success: true,
      interactions: []
    };
  } catch (error) {
    console.error('Error checking drug interactions:', error);
    return {
      success: false,
      message: 'Error checking drug interactions'
    };
  }
}

/**
 * Simple function to estimate severity from description text
 * A more robust implementation would use a specialized API or NLP
 */
function getSeverityFromDescription(description: string): 'high' | 'medium' | 'low' {
  const lowText = ['minor', 'mild', 'slight', 'minimal'];
  const highText = ['severe', 'serious', 'major', 'significant', 'dangerous', 'avoid', 'contraindicated'];
  
  description = description.toLowerCase();
  
  if (highText.some(term => description.includes(term))) {
    return 'high';
  }
  
  if (lowText.some(term => description.includes(term))) {
    return 'low';
  }
  
  return 'medium';
}

/**
 * Gets common side effects for a medication by RxCUI
 */
export async function getMedicationSideEffects(rxcui: string): Promise<any> {
  try {
    // For side effects, we need to get the NDC codes first
    const ndcResponse = await axios.get(`${RXNORM_API_BASE_URL}/${rxcui}/ndcs.json`);
    
    if (!ndcResponse.data.ndcGroup?.ndcList?.ndc || ndcResponse.data.ndcGroup.ndcList.ndc.length === 0) {
      return {
        success: false,
        message: 'No NDC codes found for this medication'
      };
    }
    
    // Use the first NDC code to get the package information
    const ndc = ndcResponse.data.ndcGroup.ndcList.ndc[0];
    const packageResponse = await axios.get(`https://rxnav.nlm.nih.gov/REST/ndcproperties.json`, {
      params: { id: ndc }
    });
    
    if (packageResponse.data.ndcPropertyList?.ndcProperty) {
      const property = packageResponse.data.ndcPropertyList.ndcProperty[0];
      return {
        success: true,
        sideEffects: {
          name: property.propertyName || 'Unknown',
          category: property.propertyCategory || 'Unknown',
          // Side effects would be included in a specialized API
          // This is a placeholder as the NDC properties API doesn't include side effects
          commonEffects: []
        }
      };
    }
    
    return {
      success: false,
      message: 'No side effect information found'
    };
  } catch (error) {
    console.error('Error getting medication side effects:', error);
    return {
      success: false,
      message: 'Error getting medication side effects'
    };
  }
}