export type TermKind = 'drug' | 'condition' | 'test' | 'allergen' | 'supplement' | 'abbreviation';

export interface Term {
  /** The canonical name, shown at the start of the explanation. */
  name: string;
  kind: TermKind;
  /** Other spellings and brand names seen in Nigerian primary care. */
  aliases?: string[];
  /** One or two plain sentences: what it is and what it is used for. Never dosing or advice. */
  plain: string;
  /** For tests only: what a result below the reference interval can be associated with. */
  lowMeans?: string;
  /** For tests only: what a result above the reference interval can be associated with. */
  highMeans?: string;
  /** For tests only: the full name, when the record usually writes an abbreviation. */
  fullName?: string;
}

/**
 * A reviewed glossary, not model output. Entries describe what something is and what it is
 * generally used for. They never give doses, never say whether something is safe or serious,
 * and never tell anyone what to do.
 */
export const TERMS: Term[] = [
  // Antibiotics
  { name: 'Amoxicillin', kind: 'drug', aliases: ['amoxil'], plain: 'An antibiotic in the penicillin family. It is used to treat bacterial infections such as chest, throat and ear infections.' },
  { name: 'Ampicillin', kind: 'drug', plain: 'An antibiotic in the penicillin family, used for bacterial infections.' },
  { name: 'Augmentin', kind: 'drug', aliases: ['co-amoxiclav', 'amoxiclav'], plain: 'An antibiotic that combines amoxicillin with clavulanic acid. It belongs to the penicillin family and treats bacterial infections.' },
  { name: 'Flucloxacillin', kind: 'drug', plain: 'An antibiotic in the penicillin family, often used for skin and soft tissue infections.' },
  { name: 'Penicillin', kind: 'drug', plain: 'One of the oldest families of antibiotics, used to treat bacterial infections.' },
  { name: 'Ceftriaxone', kind: 'drug', plain: 'An antibiotic usually given by injection in hospital, used for more serious bacterial infections.' },
  { name: 'Azithromycin', kind: 'drug', aliases: ['zithromax'], plain: 'An antibiotic used for chest, throat and some sexually transmitted infections.' },
  { name: 'Erythromycin', kind: 'drug', plain: 'An antibiotic often used when someone cannot take penicillin.' },
  { name: 'Ciprofloxacin', kind: 'drug', aliases: ['cipro'], plain: 'An antibiotic used for urinary, gut and some other bacterial infections.' },
  { name: 'Metronidazole', kind: 'drug', aliases: ['flagyl'], plain: 'A medicine that treats certain bacteria and parasites, often used for gut and dental infections.' },
  { name: 'Cotrimoxazole', kind: 'drug', aliases: ['septrin', 'bactrim', 'trimethoprim-sulfamethoxazole'], plain: 'An antibiotic combination containing a sulfa medicine. It is used for chest and urinary infections, and to prevent infections in people living with HIV.' },
  { name: 'Doxycycline', kind: 'drug', plain: 'An antibiotic used for chest infections, some tropical infections and acne.' },
  { name: 'Gentamicin', kind: 'drug', plain: 'An antibiotic given by injection, usually in hospital, for serious infections.' },

  // Antimalarials
  { name: 'Artemether-lumefantrine', kind: 'drug', aliases: ['coartem', 'lonart', 'al tablets'], plain: 'The usual tablet treatment for uncomplicated malaria. It combines two medicines that clear the malaria parasite.' },
  { name: 'Artesunate', kind: 'drug', plain: 'A malaria medicine, usually given by injection for severe malaria.' },
  { name: 'Chloroquine', kind: 'drug', plain: 'An older malaria medicine. It is no longer the first choice in most of Africa because the parasite has become resistant to it.' },
  { name: 'Quinine', kind: 'drug', plain: 'An older malaria medicine, still used in some situations.' },
  { name: 'Sulfadoxine-pyrimethamine', kind: 'drug', aliases: ['fansidar', 'sp'], plain: 'A malaria medicine containing a sulfa component, often given during pregnancy to prevent malaria.' },
  { name: 'Dihydroartemisinin-piperaquine', kind: 'drug', aliases: ['p-alaxin', 'duo-cotecxin'], plain: 'A combination tablet used to treat malaria.' },

  // Pain and fever
  { name: 'Paracetamol', kind: 'drug', aliases: ['acetaminophen', 'panadol', 'emzor paracetamol'], plain: 'A common medicine for pain and fever.' },
  { name: 'Ibuprofen', kind: 'drug', aliases: ['brufen', 'advil'], plain: 'An anti-inflammatory painkiller, used for pain, swelling and fever. It belongs to a group called NSAIDs.' },
  { name: 'Diclofenac', kind: 'drug', aliases: ['voltaren', 'cataflam'], plain: 'An anti-inflammatory painkiller in the NSAID group, often used for joint and muscle pain.' },
  { name: 'Naproxen', kind: 'drug', plain: 'An anti-inflammatory painkiller in the NSAID group.' },
  { name: 'Aspirin', kind: 'drug', aliases: ['acetylsalicylic acid'], plain: 'An NSAID used for pain and fever. At low doses it is also used to make the blood less likely to clot.' },
  { name: 'Tramadol', kind: 'drug', plain: 'A stronger painkiller related to the opioid group, used for moderate to severe pain.' },
  { name: 'Codeine', kind: 'drug', plain: 'An opioid medicine used for pain and sometimes for cough.' },
  { name: 'Morphine', kind: 'drug', plain: 'A strong opioid painkiller, used for severe pain.' },

  // Blood pressure and heart
  { name: 'Amlodipine', kind: 'drug', plain: 'A tablet for high blood pressure. It relaxes the blood vessels so blood flows more easily.' },
  { name: 'Nifedipine', kind: 'drug', aliases: ['adalat'], plain: 'A tablet for high blood pressure that relaxes the blood vessels.' },
  { name: 'Lisinopril', kind: 'drug', plain: 'A tablet for high blood pressure and some heart conditions. It belongs to a group called ACE inhibitors.' },
  { name: 'Enalapril', kind: 'drug', plain: 'A tablet for high blood pressure and heart conditions, in the ACE inhibitor group.' },
  { name: 'Losartan', kind: 'drug', plain: 'A tablet for high blood pressure, in a group called ARBs.' },
  { name: 'Atenolol', kind: 'drug', plain: 'A tablet for high blood pressure and some heart conditions. It slows the heart a little.' },
  { name: 'Propranolol', kind: 'drug', plain: 'A tablet that slows the heart, used for blood pressure, migraine and some other conditions.' },
  { name: 'Hydrochlorothiazide', kind: 'drug', aliases: ['hctz'], plain: 'A water tablet used for high blood pressure. It helps the body remove extra salt and water.' },
  { name: 'Furosemide', kind: 'drug', aliases: ['lasix', 'frusemide'], plain: 'A strong water tablet that helps the body remove extra fluid, used in heart and kidney conditions.' },
  { name: 'Methyldopa', kind: 'drug', aliases: ['aldomet'], plain: 'A blood pressure tablet commonly used during pregnancy.' },
  { name: 'Atorvastatin', kind: 'drug', plain: 'A tablet that lowers cholesterol in the blood.' },
  { name: 'Simvastatin', kind: 'drug', plain: 'A tablet that lowers cholesterol in the blood.' },
  { name: 'Warfarin', kind: 'drug', plain: 'A tablet that makes the blood less likely to clot. People taking it have regular blood tests.' },

  // Diabetes
  { name: 'Metformin', kind: 'drug', aliases: ['glucophage'], plain: 'A tablet for type 2 diabetes. It helps the body respond to insulin and lowers blood sugar.' },
  { name: 'Insulin', kind: 'drug', plain: 'A medicine given by injection that lowers blood sugar. It replaces or adds to the insulin the body makes.' },
  { name: 'Glibenclamide', kind: 'drug', aliases: ['daonil'], plain: 'A tablet for type 2 diabetes that helps the body release more insulin.' },
  { name: 'Gliclazide', kind: 'drug', plain: 'A tablet for type 2 diabetes that helps the body release more insulin.' },

  // Breathing
  { name: 'Salbutamol', kind: 'drug', aliases: ['ventolin', 'albuterol'], plain: 'An inhaler or tablet that opens the airways, used in asthma and other breathing problems.' },
  { name: 'Beclometasone', kind: 'drug', aliases: ['beclomethasone', 'becotide'], plain: 'A steroid inhaler used regularly to reduce swelling in the airways and prevent asthma attacks.' },
  { name: 'Prednisolone', kind: 'drug', plain: 'A steroid tablet that reduces inflammation, used in asthma flare-ups, allergies and several other conditions.' },
  { name: 'Hydrocortisone', kind: 'drug', plain: 'A steroid medicine that reduces inflammation. It comes as a cream, tablet or injection.' },

  // Stomach
  { name: 'Omeprazole', kind: 'drug', plain: 'A tablet that reduces the acid the stomach makes, used for ulcers and acid reflux.' },
  { name: 'Esomeprazole', kind: 'drug', plain: 'A tablet that reduces stomach acid, used for ulcers and reflux.' },
  { name: 'Metoclopramide', kind: 'drug', plain: 'A medicine for nausea and vomiting.' },
  { name: 'Hyoscine', kind: 'drug', aliases: ['buscopan'], plain: 'A medicine that eases cramping pain in the stomach and gut.' },
  { name: 'Oral rehydration salts', kind: 'drug', aliases: ['ors', 'rehydration salt'], plain: 'A powder mixed with clean water to replace the fluid and salts lost in diarrhoea or vomiting.' },

  // Allergy
  { name: 'Chlorpheniramine', kind: 'drug', aliases: ['piriton'], plain: 'An antihistamine used for allergy symptoms. It often causes drowsiness.' },
  { name: 'Loratadine', kind: 'drug', aliases: ['clarityn'], plain: 'An antihistamine used for allergy symptoms, less likely to cause drowsiness.' },
  { name: 'Cetirizine', kind: 'drug', plain: 'An antihistamine used for allergy symptoms such as sneezing, itching and rash.' },
  { name: 'Adrenaline', kind: 'drug', aliases: ['epinephrine', 'epipen'], plain: 'An emergency injection used for a severe allergic reaction.' },

  // Infections, long-term
  { name: 'Tenofovir', kind: 'drug', plain: 'An antiretroviral medicine used to treat HIV, usually as part of a combination.' },
  { name: 'Lamivudine', kind: 'drug', plain: 'An antiretroviral medicine used in HIV treatment, and sometimes in hepatitis B.' },
  { name: 'Dolutegravir', kind: 'drug', aliases: ['tld'], plain: 'An antiretroviral medicine used to treat HIV, usually combined with others in one tablet.' },
  { name: 'Isoniazid', kind: 'drug', plain: 'A medicine used to treat and prevent tuberculosis.' },
  { name: 'Rifampicin', kind: 'drug', plain: 'A medicine used to treat tuberculosis. It can turn urine orange, which is expected.' },
  { name: 'Pyrazinamide', kind: 'drug', plain: 'A medicine used as part of tuberculosis treatment.' },
  { name: 'Ethambutol', kind: 'drug', plain: 'A medicine used as part of tuberculosis treatment.' },
  { name: 'Hydroxyurea', kind: 'drug', plain: 'A medicine used in sickle cell disease to reduce how often painful crises happen.' },

  // Nerves and mind
  { name: 'Diazepam', kind: 'drug', aliases: ['valium'], plain: 'A medicine that calms the body, used for seizures, muscle spasm and short-term anxiety.' },
  { name: 'Carbamazepine', kind: 'drug', aliases: ['tegretol'], plain: 'A medicine used to prevent seizures in epilepsy, and for some kinds of nerve pain.' },
  { name: 'Phenytoin', kind: 'drug', plain: 'A medicine used to prevent seizures in epilepsy.' },
  { name: 'Phenobarbital', kind: 'drug', aliases: ['phenobarbitone'], plain: 'An older medicine used to prevent seizures in epilepsy.' },
  { name: 'Sodium valproate', kind: 'drug', aliases: ['epilim', 'valproate'], plain: 'A medicine used to prevent seizures in epilepsy and for some mood conditions.' },
  { name: 'Amitriptyline', kind: 'drug', plain: 'A medicine used for depression, and at other doses for nerve pain and migraine prevention.' },
  { name: 'Fluoxetine', kind: 'drug', aliases: ['prozac'], plain: 'A medicine used for depression and anxiety.' },
  { name: 'Haloperidol', kind: 'drug', plain: 'A medicine used for some mental health conditions, including psychosis.' },
  { name: 'Chlorpromazine', kind: 'drug', plain: 'A medicine used for some mental health conditions.' },

  // Pregnancy and women's health
  { name: 'Folic acid', kind: 'supplement', plain: 'A vitamin that helps the body make healthy blood cells. It is given in pregnancy and in conditions like sickle cell disease.' },
  { name: 'Ferrous sulphate', kind: 'supplement', aliases: ['iron tablets', 'ferrous gluconate', 'iron supplement'], plain: 'An iron supplement, used when the body is short of iron, which can cause anaemia.' },
  { name: 'Oxytocin', kind: 'drug', plain: 'A medicine used during and after childbirth to help the womb contract.' },
  { name: 'Misoprostol', kind: 'drug', plain: 'A medicine used in pregnancy care, including to help the womb contract after childbirth.' },
  { name: 'Magnesium sulphate', kind: 'drug', plain: 'A medicine given in hospital to prevent and treat fits in severe pre-eclampsia and eclampsia.' },

  // Worms and parasites
  { name: 'Albendazole', kind: 'drug', plain: 'A deworming medicine that clears common intestinal worms.' },
  { name: 'Mebendazole', kind: 'drug', plain: 'A deworming medicine that clears common intestinal worms.' },
  { name: 'Praziquantel', kind: 'drug', plain: 'A medicine used to treat schistosomiasis, sometimes called bilharzia.' },
  { name: 'Ivermectin', kind: 'drug', plain: 'A medicine used for certain parasites, including river blindness and scabies.' },

  // Supplements
  { name: 'Vitamin C', kind: 'supplement', aliases: ['ascorbic acid'], plain: 'A vitamin the body needs in small amounts, taken as a supplement.' },
  { name: 'Zinc', kind: 'supplement', plain: 'A mineral supplement, often given with rehydration salts in childhood diarrhoea.' },
  { name: 'Multivitamin', kind: 'supplement', plain: 'A supplement containing several vitamins together.' },

  // Conditions
  { name: 'Type 2 diabetes', kind: 'condition', aliases: ['type 2 diabetes mellitus', 't2dm', 'diabetes type 2'], plain: 'A long-term condition where blood sugar stays higher than it should, because the body does not respond well to insulin.' },
  { name: 'Type 1 diabetes', kind: 'condition', aliases: ['t1dm'], plain: 'A long-term condition where the body makes little or no insulin, so insulin has to be given as a medicine.' },
  { name: 'Diabetes', kind: 'condition', plain: 'A long-term condition where blood sugar stays higher than it should.' },
  { name: 'Hypertension', kind: 'condition', aliases: ['high blood pressure', 'raised blood pressure'], plain: 'Blood pressure that stays higher than normal over time. It often has no symptoms, which is why it is checked regularly.' },
  { name: 'Asthma', kind: 'condition', plain: 'A long-term condition where the airways narrow and make breathing difficult at times.' },
  { name: 'Malaria', kind: 'condition', plain: 'An infection carried by mosquitoes, causing fever, chills and body aches.' },
  { name: 'Typhoid', kind: 'condition', aliases: ['typhoid fever', 'enteric fever'], plain: 'An infection caught from contaminated food or water, causing prolonged fever and stomach upset.' },
  { name: 'Tuberculosis', kind: 'condition', aliases: ['tb', 'pulmonary tuberculosis'], plain: 'A bacterial infection that usually affects the lungs and is treated with several medicines over months.' },
  { name: 'HIV', kind: 'condition', aliases: ['human immunodeficiency virus', 'retroviral disease'], plain: 'A virus that weakens the immune system. It is managed long-term with antiretroviral medicines.' },
  { name: 'Sickle cell disease', kind: 'condition', aliases: ['sickle cell anaemia', 'ss', 'sickle cell anemia'], plain: 'An inherited condition affecting the red blood cells, which can cause episodes of pain and anaemia.' },
  { name: 'Sickle cell trait', kind: 'condition', aliases: ['as genotype'], plain: 'Carrying one sickle cell gene. People with the trait usually have no symptoms but can pass the gene on.' },
  { name: 'Anaemia', kind: 'condition', aliases: ['anemia', 'low blood level'], plain: 'Having fewer healthy red blood cells than normal, which can cause tiredness and breathlessness.' },
  { name: 'Peptic ulcer', kind: 'condition', aliases: ['ulcer', 'stomach ulcer', 'gastric ulcer', 'duodenal ulcer'], plain: 'A sore in the lining of the stomach or the first part of the gut, often causing burning pain.' },
  { name: 'Gastritis', kind: 'condition', plain: 'Irritation of the stomach lining, which can cause pain, nausea or a burning feeling.' },
  { name: 'Pneumonia', kind: 'condition', plain: 'An infection of the lungs, causing cough, fever and difficulty breathing.' },
  { name: 'Urinary tract infection', kind: 'condition', aliases: ['uti'], plain: 'An infection of the bladder or urinary system, often causing burning when passing urine.' },
  { name: 'Hepatitis B', kind: 'condition', aliases: ['hep b', 'hbv'], plain: 'A virus that affects the liver. Some people clear it and others carry it long-term.' },
  { name: 'Hepatitis C', kind: 'condition', aliases: ['hep c', 'hcv'], plain: 'A virus that affects the liver, now treatable with medicines.' },
  { name: 'Stroke', kind: 'condition', aliases: ['cva', 'cerebrovascular accident'], plain: 'When blood flow to part of the brain is interrupted, affecting movement, speech or other functions.' },
  { name: 'Heart failure', kind: 'condition', aliases: ['congestive cardiac failure', 'ccf'], plain: 'When the heart does not pump as strongly as it should, causing breathlessness and swelling.' },
  { name: 'Epilepsy', kind: 'condition', aliases: ['seizure disorder', 'convulsions'], plain: 'A condition where someone has repeated seizures, usually managed with daily medicine.' },
  { name: 'Arthritis', kind: 'condition', aliases: ['osteoarthritis', 'joint pain'], plain: 'Pain and stiffness in the joints, which can have several causes.' },
  { name: 'Migraine', kind: 'condition', plain: 'A type of severe headache, often on one side, sometimes with nausea or sensitivity to light.' },
  { name: 'Lactose intolerance', kind: 'condition', plain: 'Difficulty digesting the sugar in milk, which can cause bloating, cramps or diarrhoea after dairy.' },
  { name: 'Eczema', kind: 'condition', aliases: ['atopic dermatitis'], plain: 'A skin condition causing dry, itchy and inflamed patches.' },
  { name: 'Allergic rhinitis', kind: 'condition', aliases: ['hay fever'], plain: 'Sneezing, a blocked or runny nose and itchy eyes caused by an allergy.' },
  { name: 'Glaucoma', kind: 'condition', plain: 'An eye condition, usually linked to pressure inside the eye, that can affect sight over time.' },
  { name: 'Cataract', kind: 'condition', plain: 'Clouding of the lens of the eye, which makes vision blurry.' },
  { name: 'Chronic kidney disease', kind: 'condition', aliases: ['kidney disease', 'ckd', 'renal failure'], plain: 'Long-term reduced kidney function, usually followed with regular blood tests.' },
  { name: 'Pre-eclampsia', kind: 'condition', aliases: ['preeclampsia'], plain: 'A pregnancy condition involving raised blood pressure and protein in the urine, which is monitored closely.' },
  { name: 'Fibroids', kind: 'condition', aliases: ['uterine fibroids'], plain: 'Non-cancerous growths in the womb, which can cause heavy periods or pressure symptoms.' },
  { name: 'Goitre', kind: 'condition', aliases: ['goiter', 'thyroid swelling'], plain: 'A swelling of the thyroid gland in the neck.' },
  { name: 'Depression', kind: 'condition', plain: 'A mental health condition involving low mood and loss of interest over a sustained period.' },
  { name: 'Measles', kind: 'condition', plain: 'A viral infection causing fever and a rash, prevented by vaccination.' },
  { name: 'Cholera', kind: 'condition', plain: 'A severe infection causing watery diarrhoea, caught from contaminated water or food.' },

  // Tests and measurements
  { name: 'HbA1c', kind: 'test', aliases: ['hba1c', 'glycated haemoglobin', 'a1c'], plain: 'A blood test that shows the average blood sugar over the past two to three months.' },
  { name: 'Blood pressure', kind: 'test', aliases: ['bp'], plain: 'A measurement of the pressure of blood in the arteries, written as two numbers.' },
  { name: 'Full blood count', kind: 'test', aliases: ['fbc', 'complete blood count', 'cbc'], plain: 'A blood test that measures the different types of cells in the blood.' },
  {
    name: 'Haemoglobin',
    kind: 'test',
    aliases: ['hemoglobin', 'hb', 'pcv', 'packed cell volume'],
    fullName: 'haemoglobin',
    plain: 'Haemoglobin is a protein in red blood cells that carries oxygen around your body.',
    lowMeans: 'anaemia',
  },
  { name: 'Malaria rapid test', kind: 'test', aliases: ['rdt', 'malaria rdt', 'mp'], plain: 'A quick finger-prick test that checks for malaria parasites.' },
  { name: 'Fasting blood sugar', kind: 'test', aliases: ['fbs', 'blood sugar', 'random blood sugar', 'rbs'], plain: 'A blood test measuring the amount of sugar in the blood.' },
  { name: 'Widal test', kind: 'test', plain: 'A blood test sometimes used when typhoid is suspected. Its results are interpreted with care because it can be misleading on its own.' },
  { name: 'Urinalysis', kind: 'test', aliases: ['urine test'], plain: 'A test of a urine sample, used to check for infection and other things.' },
  { name: 'CD4 count', kind: 'test', aliases: ['cd4'], plain: 'A blood test showing the strength of the immune system in people living with HIV.' },
  { name: 'Viral load', kind: 'test', plain: 'A blood test showing how much virus is in the blood, used in HIV and hepatitis care.' },
  { name: 'Genotype', kind: 'test', aliases: ['hb genotype'], plain: 'A blood test showing which haemoglobin genes someone has, such as AA, AS or SS.' },
  { name: 'Blood group', kind: 'test', aliases: ['blood type'], plain: 'The type of blood someone has, such as O positive, which matters for transfusion and in pregnancy.' },

  // Allergens
  { name: 'Sulfa drugs', kind: 'allergen', aliases: ['sulfa', 'sulphonamide', 'sulfonamide'], plain: 'A group of medicines including some antibiotics. Some people react to them.' },
  { name: 'Peanuts', kind: 'allergen', aliases: ['groundnut', 'groundnuts', 'peanut'], plain: 'A common food allergen.' },
  { name: 'Shellfish', kind: 'allergen', aliases: ['prawns', 'crayfish'], plain: 'A common food allergen.' },
  { name: 'Dust mite', kind: 'allergen', aliases: ['house dust'], plain: 'A common cause of allergy symptoms in the home.' },
  { name: 'NSAIDs', kind: 'allergen', aliases: ['nsaid', 'anti-inflammatory'], plain: 'A group of anti-inflammatory painkillers including ibuprofen, diclofenac and aspirin.' },
// Abbreviations and shorthand common in Nigerian clinical notes. Several have more than one
  // possible meaning, so each entry says what it means in the context it is usually written in,
  // and nothing is expanded where the note itself is ambiguous.
  { name: 'c/o', kind: 'abbreviation', aliases: ['co', 'complains of'], plain: 'Short for "complains of", meaning what the patient reported.' },
  { name: 'Pt', kind: 'abbreviation', plain: 'Short for "patient".' },
  { name: 'Dx', kind: 'abbreviation', plain: 'Short for "diagnosis", the condition the health worker recorded.' },
  { name: 'Rx', kind: 'abbreviation', plain: 'Short for the treatment or prescription that was recorded.' },
  { name: 'Hx', kind: 'abbreviation', plain: 'Short for "history", meaning past medical information.' },
  { name: 'O/E', kind: 'abbreviation', aliases: ['oe', 'on examination'], plain: 'Short for "on examination", meaning what the health worker found when examining the patient.' },
  { name: 'SOB', kind: 'abbreviation', aliases: ['shortness of breath'], plain: 'Short for "shortness of breath".' },
  { name: 'PO', kind: 'abbreviation', aliases: ['per os'], plain: 'Means the medicine is taken by mouth.' },
  { name: 'IV', kind: 'abbreviation', aliases: ['intravenous'], plain: 'Means given into a vein, usually through a drip.' },
  { name: 'IM', kind: 'abbreviation', aliases: ['intramuscular'], plain: 'Means given by injection into a muscle.' },
  { name: 'PRN', kind: 'abbreviation', aliases: ['prn'], plain: 'Means taken only when needed, rather than on a fixed schedule.' },
  { name: 'BD', kind: 'abbreviation', aliases: ['bid', 'twice daily'], plain: 'In a medicine instruction, means twice a day.' },
  { name: 'TDS', kind: 'abbreviation', aliases: ['tid', 'three times daily'], plain: 'In a medicine instruction, means three times a day.' },
  { name: 'QDS', kind: 'abbreviation', aliases: ['qid', 'four times daily'], plain: 'In a medicine instruction, means four times a day.' },
  { name: 'OD', kind: 'abbreviation', aliases: ['once daily'], plain: 'In a medicine instruction, means once a day.' },
  { name: 'Nocte', kind: 'abbreviation', aliases: ['at night'], plain: 'In a medicine instruction, means at night.' },
  { name: 'Stat', kind: 'abbreviation', plain: 'In a medicine instruction, means straight away as a single dose.' },
  { name: 'q8h', kind: 'abbreviation', aliases: ['q 8h', 'every eight hours'], plain: 'In a medicine instruction, means every eight hours.' },
  { name: 'q6h', kind: 'abbreviation', aliases: ['q 6h'], plain: 'In a medicine instruction, means every six hours.' },
  { name: 'q12h', kind: 'abbreviation', aliases: ['q 12h'], plain: 'In a medicine instruction, means every twelve hours.' },
  { name: 'RDT', kind: 'abbreviation', aliases: ['rapid diagnostic test'], plain: 'Short for "rapid diagnostic test", a quick test that checks for signs of a particular infection.' },
  { name: 'FBC', kind: 'abbreviation', plain: 'Short for "full blood count", a blood test measuring the different cells in the blood.' },
  { name: 'U&E', kind: 'abbreviation', aliases: ['ue', 'urea and electrolytes'], plain: 'Short for "urea and electrolytes", blood tests that check kidney function and salt levels.' },
  { name: 'LFT', kind: 'abbreviation', plain: 'Short for "liver function tests", blood tests that check the liver.' },
  { name: 'SpO2', kind: 'abbreviation', aliases: ['spo 2', 'oxygen saturation', 'sats'], plain: 'A measurement of how much oxygen the blood is carrying, usually taken with a clip on the finger.' },
  { name: 'Room air', kind: 'abbreviation', plain: 'Means the measurement was taken while breathing ordinary air, without extra oxygen.' },
  { name: 'Temp', kind: 'abbreviation', aliases: ['temperature'], plain: 'The body temperature recorded at the time of the visit.' },
  { name: 'Wheeze', kind: 'abbreviation', plain: 'A whistling sound heard when air moves through narrowed airways.' },
  { name: 'mmHg', kind: 'abbreviation', plain: 'The unit blood pressure is measured in.' },
  { name: 'g/dL', kind: 'abbreviation', plain: 'A unit used for some blood measurements, such as haemoglobin.' },
  { name: 'X-ray', kind: 'test', aliases: ['xray', 'radiograph'], plain: 'An imaging test that lets clinicians look at bones and some other structures.' },
  { name: 'Ultrasound', kind: 'test', aliases: ['uss', 'scan'], plain: 'An imaging test that uses sound waves to look inside the body.' },
  { name: 'Orthopaedic', kind: 'abbreviation', aliases: ['orthopedic', 'ortho'], plain: 'The service that assesses and treats bones, joints and related structures.' },
];

const normalise = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Longest names first, so "type 2 diabetes" wins over "diabetes". */
const INDEX: { key: string; term: Term }[] = TERMS.flatMap((term) => [
  { key: normalise(term.name), term },
  ...(term.aliases ?? []).map((alias) => ({ key: normalise(alias), term })),
]).sort((a, b) => b.key.length - a.key.length);

/** Finds every distinct term mentioned in a claim value, longest match first. */
export function findTerms(value: string): Term[] {
  const haystack = ` ${normalise(value)} `;
  const found: Term[] = [];
  const used: string[] = [];

  for (const { key, term } of INDEX) {
    if (found.includes(term)) continue;
    if (!haystack.includes(` ${key} `) && !haystack.includes(`${key} `) && !haystack.includes(` ${key}`)) continue;
    // Skip a shorter term already covered by a longer one, e.g. "diabetes" inside "type 2 diabetes".
    if (used.some((longer) => longer.includes(key))) continue;
    used.push(key);
    found.push(term);
  }
  return found.slice(0, 3);
}
