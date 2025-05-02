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
 * 
 * This implementation includes a fallback mechanism that uses a hardcoded
 * list of known interactions while we resolve issues with the external API.
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
    
    // First check for interactions using known medication names
    const knownInteractions = checkKnownInteractions(medicationNames);
    
    if (knownInteractions.interactions.length > 0) {
      console.log('Found interactions using known medication database');
      return knownInteractions;
    }
    
    // If we have enough RxCUIs, try the external API
    if (validRxcuis.length >= 2) {
      try {
        // Try to use the external API
        const externalResults = await checkDrugInteractions(validRxcuis, nameToRxcui);
        
        if (externalResults.success && externalResults.interactions.length > 0) {
          return externalResults;
        }
      } catch (apiError) {
        console.error('External API error, falling back to local database:', apiError);
        // Continue to fallback if external API fails
      }
    }
    
    // No interactions found or external API failed
    console.log('No interactions found in external API or local database');
    return {
      success: true,
      interactions: []
    };
  } catch (error) {
    console.error('Error checking drug interactions by names:', error);
    return {
      success: false,
      message: 'Error checking drug interactions'
    };
  }
}

/**
 * Checks for known common medication interactions
 * This is a fallback for when the external API is not available
 */
export function checkKnownInteractions(medicationNames: string[]): { success: boolean; interactions: any[] } {
  const normalizedNames = medicationNames.map(name => name.toLowerCase().trim());
  const interactions: any[] = [];
  
  // Common known drug interactions
  const knownInteractionPairs = [
    {
      drug1: 'warfarin',
      drug2: 'aspirin',
      description: 'Concurrent use of warfarin and aspirin may result in an increased risk of bleeding.',
      severity: 'high'
    },
    {
      drug1: 'warfarin',
      drug2: 'ibuprofen',
      description: 'Concurrent use of warfarin and ibuprofen may result in an increased risk of bleeding.',
      severity: 'high'
    },
    {
      drug1: 'warfarin',
      drug2: 'nsaid',
      description: 'Concurrent use of warfarin and NSAIDs may result in an increased risk of bleeding.',
      severity: 'high'
    },
    {
      drug1: 'lisinopril',
      drug2: 'spironolactone',
      description: 'Concurrent use may result in hyperkalemia (elevated potassium levels).',
      severity: 'medium'
    },
    {
      drug1: 'simvastatin',
      drug2: 'erythromycin',
      description: 'Erythromycin may increase the level of simvastatin, increasing the risk of muscle injury (myopathy).',
      severity: 'high'
    },
    {
      drug1: 'digoxin',
      drug2: 'amiodarone',
      description: 'Amiodarone may increase the level of digoxin, increasing the risk of digoxin toxicity.',
      severity: 'high'
    },
    {
      drug1: 'fluoxetine',
      drug2: 'tramadol',
      description: 'Concurrent use may increase the risk of serotonin syndrome.',
      severity: 'high'
    },
    {
      drug1: 'methotrexate',
      drug2: 'ibuprofen',
      description: 'NSAIDs like ibuprofen may increase methotrexate levels, increasing the risk of toxicity.',
      severity: 'high'
    },
    {
      drug1: 'methotrexate',
      drug2: 'nsaid',
      description: 'NSAIDs may increase methotrexate levels, increasing the risk of toxicity.',
      severity: 'high'
    },
    {
      drug1: 'ciprofloxacin',
      drug2: 'calcium',
      description: 'Calcium may reduce the absorption of ciprofloxacin, making it less effective.',
      severity: 'medium'
    },
    {
      drug1: 'levothyroxine',
      drug2: 'calcium',
      description: 'Calcium supplements may reduce the absorption of levothyroxine.',
      severity: 'medium'
    },
    {
      drug1: 'metformin',
      drug2: 'furosemide',
      description: 'Furosemide may increase the risk of lactic acidosis in patients taking metformin.',
      severity: 'medium'
    },
    {
      drug1: 'aspirin',
      drug2: 'ibuprofen',
      description: 'Using multiple NSAIDs together increases the risk of gastrointestinal bleeding and ulcers.',
      severity: 'medium'
    },
    {
      drug1: 'aspirin',
      drug2: 'nsaid',
      description: 'Using multiple NSAIDs together increases the risk of gastrointestinal bleeding and ulcers.',
      severity: 'medium'
    }
  ];
  
  // Check for interactions
  for (const pair of knownInteractionPairs) {
    // Add special handling for common medication classes
    const nsaids = ['nsaid', 'ibuprofen', 'naproxen', 'aspirin', 'diclofenac', 'meloxicam', 'indomethacin'];
    const bloodThinners = ['warfarin', 'coumadin', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto'];
    
    // Helper function to check if a name belongs to a medication class
    const isInClass = (name: string, classNames: string[]) => {
      return classNames.some(className => name.includes(className));
    };
    
    // Do normal checks for exact matches
    let hasDrug1 = normalizedNames.some(name => name.includes(pair.drug1));
    let hasDrug2 = normalizedNames.some(name => name.includes(pair.drug2));
    
    // Special class-based checks
    if (pair.drug1 === 'warfarin') {
      hasDrug1 = normalizedNames.some(name => isInClass(name, bloodThinners));
    }
    
    if (pair.drug2 === 'warfarin') {
      hasDrug2 = normalizedNames.some(name => isInClass(name, bloodThinners));
    }
    
    if (pair.drug1 === 'ibuprofen' || pair.drug1 === 'aspirin') {
      hasDrug1 = normalizedNames.some(name => isInClass(name, nsaids));
    }
    
    if (pair.drug2 === 'ibuprofen' || pair.drug2 === 'aspirin') {
      hasDrug2 = normalizedNames.some(name => isInClass(name, nsaids));
    }
    
    if (hasDrug1 && hasDrug2) {
      console.log(`Found interaction between ${pair.drug1} and ${pair.drug2}`);
      interactions.push(pair);
    }
  }
  
  return {
    success: true,
    interactions
  };
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