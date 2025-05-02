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
    const response = await axios.get(`${RXNORM_API_BASE_URL}.json`, {
      params: {
        name
      }
    });

    if (response.data.idGroup && response.data.idGroup.rxnormId && response.data.idGroup.rxnormId.length > 0) {
      return {
        success: true,
        rxcui: response.data.idGroup.rxnormId[0]
      };
    }

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
 * Checks for interactions between multiple medications
 */
export async function checkDrugInteractions(rxcuiList: string[]): Promise<any> {
  try {
    if (!rxcuiList || rxcuiList.length === 0) {
      return {
        success: true,
        interactions: []
      };
    }

    const response = await axios.get(`${DRUG_INTERACTION_API_BASE_URL}/list.json`, {
      params: {
        rxcuis: rxcuiList.join('+')
      }
    });

    if (response.data.fullInteractionTypeGroup) {
      // Extract detailed interactions
      const interactionGroup = response.data.fullInteractionTypeGroup.find(
        (g: any) => g.sourceName === 'DrugBank'
      ) || response.data.fullInteractionTypeGroup[0];

      if (interactionGroup && interactionGroup.fullInteractionType) {
        const interactions = interactionGroup.fullInteractionType.map((interaction: any) => {
          const drug1 = interaction.minConcept[0].name;
          const drug2 = interaction.minConcept[1].name;
          const description = interaction.description;
          const severity = getSeverityFromDescription(description);

          return {
            drug1,
            drug2,
            description,
            severity
          };
        });

        return {
          success: true,
          interactions
        };
      }
    }

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