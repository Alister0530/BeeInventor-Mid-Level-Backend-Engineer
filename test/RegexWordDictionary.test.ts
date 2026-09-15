import { RegexWordDictionary } from '../solution/RegexWordDictionary';
import { runWordDictionaryContractTests } from './wordDictionary.contract';

runWordDictionaryContractTests('RegexWordDictionary', () => new RegexWordDictionary());
