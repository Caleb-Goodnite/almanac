# Research basis

Every default, formula, threshold and coaching guideline in Almanac is listed here with its source and how the app uses it. The code lives in `lib/science` (calculations) and `lib/safety` (limits).

**How to read the confidence column**

- **High**: taken directly from a peer-reviewed paper or an official guideline, and both the citation and the specific figure were checked against PubMed, the full text or the issuing body's own page (October 2026).
- **Medium**: from a recognised source, but the specific figure was not re-read in the primary document during this pass, or it is being applied a little outside the population it was derived from.
- **Convention**: widely used in practice, not established by a study. Treated as a starting point only.
- **Policy**: a deliberately cautious product decision. Not a research finding. These need clinical review before launch (see `COMPLIANCE.md`).

Nothing here is medical advice, and no citation should be read as the authors endorsing this app.

---

## <a id="energy"></a>1. Energy expenditure

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Resting energy, adults | Mifflin-St Jeor: `10 x kg + 6.25 x cm - 5 x age + 5` (men), `- 161` (women) | Mifflin et al. 1990 [1]. A systematic review found it the most reliable of the common equations in non-obese and obese adults [2]. | High |
| Resting energy, sex not given | Midpoint constant (`- 78`) | Our own handling. No equation exists for this case. | Convention |
| Resting energy when body fat is known | `370 + 21.6 x fat-free mass (kg)` | Cunningham 1991 [35], a synthesis of body-composition studies; the equation explains 65-90% of the variation in resting expenditure. It is the equation commonly called "Katch-McArdle". Only as accurate as the body-fat figure entered, so it is used only when the user supplies one. | High |
| Resting energy, ages 13-17 | Schofield: `17.686 x kg + 658.2` (boys), `13.384 x kg + 692.6` (girls) | Schofield 1985 [3], as tabulated by FAO/WHO/UNU 2004 [4]. Used because Mifflin-St Jeor was developed in adults aged 19-78. | High |
| Physical activity level (PAL) | 1.40 / 1.55 / 1.75 / 1.90 / 2.20 for the five activity choices | Chosen inside the FAO/WHO/UNU lifestyle bands: sedentary or light 1.40-1.69, active 1.70-1.99, vigorous 2.00-2.40 [4]. Doubly-labelled-water data agree: average adult PAL is 1.7-1.8 and sustainable lifestyles range from about 1.1-1.2 to 2.0-2.5 [36]; about 1.2 is the level of non-ambulant people [37]. The widely copied 1.2 / 1.375 / 1.55 / 1.725 / 1.9 set has no primary source we could find and its "sedentary" value matches bed- or chair-bound people, so it was replaced. The band edges are from the sources; the exact value picked within each band is ours. | High for the bands, Convention for the point values |
| Self-reported activity runs high | Onboarding says "between two, pick the lower one" | Lichtman et al. 1992 [38]: people who believed they could not lose weight under-reported intake by 47% and over-reported activity by 51% on average. A small study in a specific group, so it supports the caution rather than a correction factor. | Medium |
| Energy in a kg of weight change | 7,700 kcal/kg (3,500 kcal/lb) | Hall 2008 [5] shows the rule fits people with higher body fat and overstates the deficit needed for leaner people. Used as an approximation and described as one. | Medium |

**How it is used.** Onboarding computes resting energy, multiplies by the activity level for a first estimate of daily expenditure (TDEE), and converts the chosen weekly rate into a daily calorie adjustment. Because the multiplier is the weakest link, it is replaced by the adaptive estimate below as soon as there is enough data.

### <a id="adaptive"></a>Adaptive TDEE

`expenditure = average intake - (weight slope in kg/day x 7,700)`

This is energy balance, the same principle used by adaptive trackers such as MacroFactor. The specific rules are ours:

| Rule | Value | Basis | Confidence |
|---|---|---|---|
| Minimum data | 14-day span, 10 logged days, 6 weigh-ins, in a 28-day window | Daily weight varies by a kilogram or more from water and gut content; shorter windows mostly measure noise. | Convention |
| Ignore days under 600 kcal | Treated as incomplete logging | Half-logged days would make expenditure look far too low. | Convention |
| Bound to within 30% of the formula | Hard clamp | Under-reporting of intake is well documented [38]; this stops one poorly logged month producing an unsafe target. | Policy |
| Use a weekly average, not single weigh-ins | 7-day moving average and a 4-week regression | Body weight follows a weekly rhythm, higher after weekends and lower by Friday [39], on top of day-to-day water shifts. | High |
| Blend with the formula | 35% / 60% / 85% weight on observed data by confidence, scaled by logging coverage | Our own shrinkage. | Convention |

The coach is told the confidence level and must say so when it is low.

---

## <a id="protein"></a>2. Protein and macronutrients

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Protein, adults who lift | 1.6 g/kg/day; range shown 1.6-2.2 | Morton et al. 2018 [6]: 49 trials, 1,863 participants. The break point was 1.62 g/kg/day with a 95% confidence interval of 1.03 to 2.20, which is where the 2.2 upper figure comes from. The authors note the break-point model was not itself statistically significant (p = 0.079), so 1.6 is best read as "about here", not a sharp threshold. | High |
| Protein, adults who lift, in a deficit | 2.0 g/kg/day | Hector and Phillips 2018 [40]: 1.6-2.4 g/kg/day during weight loss. Longland et al. 2016 [41], a randomised trial: 2.4 g/kg beat 1.2 g/kg for lean mass and fat loss during a large deficit with hard training. Helms et al. 2014 [7]: 2.3-3.1 g/kg of lean mass. 2.0 is the middle of the 1.6-2.4 range. | High |
| Protein, adults who do not lift | 1.2 g/kg/day (1.6 in a deficit) | Phillips, Chevalier and Leidy 2016 [42]: "at least 1.2 to 1.6 g/(kg·day)" is a better target than the 0.8 RDA for health in adults. Inside the 10-35% AMDR [9]. | High |
| Protein, teens | 1.4 g/kg/day if lifting, otherwise 1.0; never over 30% of calories | Lower end of the ISSN range [8] and the 10-30% AMDR for ages 4-18 [9]. The adult trials in [6] did not include adolescents. | Medium |
| Protein reference weight | Bodyweight capped at the weight giving BMI 30 | Protein needs follow lean mass, so g/kg of total weight overshoots at higher weights. The cap itself is a practical convention. | Convention |
| Fat | 30% of calories (25% for adults in a deficit) | AMDR: 20-35% adults, 25-35% ages 4-18 [9]. | High |
| Carbohydrate | The remainder | AMDR 45-65% [9] is checked, not forced. | High |
| Fiber | 14 g per 1,000 kcal | Dietary Reference Intakes [9], adopted by the Dietary Guidelines for Americans 2020-2025 [10]. | High |

---

## <a id="rate"></a>3. Rate of weight change

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Fat loss, adults | Default 0.5%, maximum 1.0% of bodyweight per week | Helms et al. 2014 [7]: 0.5-1%/week to retain muscle. Garthe et al. 2011 [11]: athletes losing about 0.7%/week gained lean mass while those losing about 1.4%/week did not. | High |
| Muscle gain | Default 0.25%, maximum 0.5% per week | Iraki et al. 2019 [12]: 0.25-0.5%/week for novice and intermediate lifters. | High |
| Warning on measured loss | Shown when the weight trend exceeds the maximum above | Same sources. | High |

---

## <a id="volume"></a>4. Resistance training

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Weekly volume target | 10-20 hard sets per muscle group | Lower bound: graded dose-response, with 10+ weekly sets producing more growth than fewer [13]; the 2026 ACSM position stand (137 systematic reviews) reports hypertrophy enhanced at 10 or more sets per week [14]. Upper bound: 12-20 sets performed as well as more than 20 for most muscles in trained men [15], and returns diminish as volume rises [16]. | High |
| Counting indirect work | A set counts 1 for its primary muscles and 0.5 for secondary ones | Pelland et al. 2026 [16]: the "fractional" method fitted the data best. | High |
| What counts as a hard set | Not a warm-up, and 4 or fewer reps in reserve (RPE 6+) | RPE = 10 - RIR scale [17]. Training to failure is not required for growth [18]. The cut-off at 4 RIR is our choice. | Medium |
| Frequency | Each muscle group at least twice a week | Schoenfeld et al. 2016 [19]. The 2026 meta-regression [16] finds frequency matters clearly for strength and little for size once volume is equal, so the app treats this as a soft suggestion. | Medium |
| Progressive overload | Coach suggests adding load or reps when the top of a rep range is reached at the target effort | ACSM position stands [14], [20]. | High |
| Estimated 1RM | Mean of Epley `w(1 + r/30)` and Brzycki `w x 36/(37 - r)`, from sets of 10 reps or fewer | The two formulas are from Epley 1985 (a coaching manual) and Brzycki 1993 (*JOPERD* 64:88-90); neither is indexed in PubMed and we did not retrieve them. The rep limit is from Reynolds et al. 2006 [43]: 1RM can be estimated accurately from multiple-rep sets, 5-rep sets predict best, and no more than 10 reps should be used with linear equations. | High for the rep limit, Medium for the formulas |

---

## <a id="activity"></a>5. Physical activity

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Adults | 150-300 min/week moderate or 75-150 min vigorous aerobic activity; muscle strengthening on 2 or more days a week | WHO 2020 guidelines [21], confirmed in the full text. | High |
| Ages 13-17 | An average of 60 min/day moderate-to-vigorous activity; vigorous and muscle- and bone-strengthening activity on at least 3 days a week | WHO 2020 guidelines [21], both figures confirmed in the full text. | High |
| Calories burned | `MET x kg x hours`, MET values from the 2024 Adult Compendium | Herrmann et al. 2024 [22]; values and codes copied from pacompendium.com and listed in `lib/science/met.ts`. | High |
| Caveat on calories burned | Always labelled an estimate; never added back to the calorie budget; device calorie figures are not imported | METs are population averages and gross of resting energy. Adult METs fit teenagers less well; a Youth Compendium exists [23] and is not yet implemented. Wearables do no better: in a validation of seven wrist devices none estimated energy expenditure within 20% [44], and a systematic review of 158 studies found no brand accurate for energy expenditure [45]. | High |
| Intensity by MET | Light under 3, moderate 3 to under 6, vigorous 6+ | Standard WHO/ACSM bands [24]. | High |

## <a id="heart-rate"></a>6. Heart rate

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Maximum heart rate | `208 - 0.7 x age` | Tanaka et al. 2001 [25], from 351 studies and a laboratory cross-validation. Individual error is commonly 10 beats or more. | High |
| Zones, % of maximum | Light 57-63, moderate 64-76, vigorous 77-95, near-maximal 96+ | ACSM position stand, Garber et al. 2011 [24]. The stand itself is paywalled and was not re-read; the moderate and vigorous edges were confirmed in several independent papers that reproduce its table. | Medium |
| Zones, heart-rate reserve | Light 30-39, moderate 40-59, vigorous 60-89, near-maximal 90+ | Same [24], confirmed only through secondary reproductions, some of which give slightly different vigorous upper edges (84 or 85). Implemented in `lib/science/heart.ts` but not yet shown in the UI. | Medium |
| Where heart rate comes from | The app asks for resting and average heart rate and explains how to get them from a watch, band, chest strap or a manual pulse count | Wrist devices measure heart rate adequately in controlled tests (median error under 5% for most devices in cycling), with larger errors during walking, at higher BMI and on darker skin [44]; Apple Watch and Garmin were the most accurate brands in a systematic review [45]. | High |
| Why resting heart rate is tracked | Shown as a trend in the check-in | Higher resting heart rate is associated with higher all-cause and cardiovascular mortality in a meta-analysis of 46 cohort studies (about 9% per 10 beats/min) [46]. This is an association in populations; the app shows the number and makes no health claim about an individual reading. | High |

## <a id="sleep"></a>7. Sleep

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Adults | At least 7 hours; target range 7-9 | AASM and Sleep Research Society consensus [26]; National Sleep Foundation [27]. | High |
| Ages 13-18 | 8-10 hours | AASM consensus statement for paediatric populations [28]. | High |

## <a id="hydration"></a>8. Hydration

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Adults | 3.0 L (men), 2.2 L (women) from drinks per day | Dietary Reference Intakes for Water [29]: Adequate Intake for total water 3.7 L and 2.7 L, of which about 81% comes from fluids. | High |
| Teens | 2.7 L / 1.9 L (14-18), 1.95 L / 1.7 L (13) | Same DRI table: total water 3.3 / 2.3 L (ages 14-18) and 2.4 / 2.1 L (ages 9-13), confirmed in reproductions of the table. The 81% drinks share was measured in adults aged 19-30; applying it to teens is our assumption. | Medium |
| Framing | A reference point, not a requirement | The DRI report itself says needs vary widely with climate and activity and that thirst is an adequate guide for most healthy people. | High |

---

## <a id="safety"></a>9. Safety limits

| What | Value in the app | Source | Confidence |
|---|---|---|---|
| Minimum age | 13 | US COPPA threshold; see `COMPLIANCE.md`. | n/a |
| No deficit when underweight (adults) | BMI under 18.5 | WHO adult underweight cut-off. | High |
| Adult calorie floor | 1,200 kcal (women), 1,500 kcal (men or unspecified) | The 2013 AHA/ACC/TOS obesity guideline [47] describes prescribing "1200 to 1500 kcal/d for women and 1500 to 1800 kcal/d for men" in comprehensive lifestyle programmes. The app uses the bottom of each range as a floor it will not go below. Note the guideline's context: supervised programmes for adults with overweight or obesity. For lean or very active people these floors are too low to be a target, which is why the 25% deficit cap usually binds first. | High for the figures, Policy for using them as a floor |
| Largest deficit, adults | 25% of estimated expenditure | Our limit. | Policy |
| Teen approach overall | Focus on habits, sleep, activity and strength, not weight | AAP clinical report, Golden et al. 2016 [30]: "The focus should be on a healthy lifestyle rather than on weight." A five-year cohort study found adolescents who dieted were at higher risk of later disordered eating and of weight gain [48]. The AAP 2023 obesity guideline [31] places treatment of adolescent obesity in supervised, family-based care. | High |
| Teen fat loss allowed at all | Yes, with the limits below | **Product decision by the app owner.** Not an AAP recommendation. | Policy |
| Teen maximum loss rate | 0.5% of bodyweight per week; default 0.25% | Half the adult figures. | Policy |
| Teen largest deficit | 15% of estimated expenditure | Our limit. | Policy |
| Teen calorie floor | The higher of estimated resting needs and 1,600 kcal (girls) or 1,800 kcal (boys or unspecified) | Our limit. | Policy |
| Teen BMI-for-age bands | Under the 25th percentile: no deficit. 25th to 85th: default rate only. 85th and above: up to the teen maximum. | Percentiles computed from the CDC 2000 growth reference (LMS method) [32]. The 85th percentile is the CDC overweight threshold; the 25th is our own cautious line. | Policy |
| Disordered-eating signals | Supportive message and resources replace optimisation; deficit targets are withdrawn | Approach follows [30]. Helplines listed in the app were checked against the US Office on Women's Health 2026 materials and the organisations' own sites [33]. | Medium |

---

## <a id="adherence"></a>10. Product principles with evidence behind them

| Principle | Source | Confidence |
|---|---|---|
| Logging speed and consistency matter more than precision | Burke et al. 2011 [34], a systematic review: more consistent self-monitoring of diet, activity and weight was associated with more weight loss. | High |
| Smoothed weight trend, never single weigh-ins | Follows from day-to-day variability; standard practice. | Convention |

---

## References

1. Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. *Am J Clin Nutr.* 1990;51(2):241-7. doi:10.1093/ajcn/51.2.241. PMID 2305711.
2. Frankenfield D, Roth-Yousey L, Compher C. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. *J Am Diet Assoc.* 2005;105(5):775-89. doi:10.1016/j.jada.2005.02.005. PMID 15883556.
3. Schofield WN. Predicting basal metabolic rate, new standards and review of previous work. *Hum Nutr Clin Nutr.* 1985;39 Suppl 1:5-41. PMID 4044297.
4. FAO/WHO/UNU. *Human energy requirements: report of a joint expert consultation.* Rome, 2004. Chapter 5. https://www.fao.org/4/y5686e/y5686e07.htm
5. Hall KD. What is the required energy deficit per unit weight loss? *Int J Obes (Lond).* 2008;32(3):573-6. doi:10.1038/sj.ijo.0803720. PMID 17848938.
6. Morton RW, Murphy KT, McKellar SR, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. *Br J Sports Med.* 2018;52(6):376-384. doi:10.1136/bjsports-2017-097608. PMID 28698222.
7. Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. *J Int Soc Sports Nutr.* 2014;11:20. doi:10.1186/1550-2783-11-20. PMID 24864135.
8. Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. *J Int Soc Sports Nutr.* 2017;14:20. doi:10.1186/s12970-017-0177-8. PMID 28642676.
9. Institute of Medicine. *Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids.* National Academies Press, 2005.
10. US Department of Agriculture and US Department of Health and Human Services. *Dietary Guidelines for Americans, 2020-2025.* 9th ed. https://www.dietaryguidelines.gov
11. Garthe I, Raastad T, Refsnes PE, et al. Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. *Int J Sport Nutr Exerc Metab.* 2011;21(2):97-104. doi:10.1123/ijsnem.21.2.97. PMID 21558571.
12. Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. *Sports (Basel).* 2019;7(7):154. doi:10.3390/sports7070154. PMID 31247944.
13. Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. *J Sports Sci.* 2017;35(11):1073-1082. doi:10.1080/02640414.2016.1210197. PMID 27433992.
14. Currier BS, D'Souza AC, Singh MAF, et al. American College of Sports Medicine Position Stand. Resistance training prescription for muscle function, hypertrophy, and physical performance in healthy adults: an overview of reviews. *Med Sci Sports Exerc.* 2026;58(4):851-872. doi:10.1249/MSS.0000000000003897. PMID 41843416.
15. Baz-Valle E, Balsalobre-Fernández C, Alix-Fages C, Santos-Concejero J. A systematic review of the effects of different resistance training volumes on muscle hypertrophy. *J Hum Kinet.* 2022;81:199-210. doi:10.2478/hukin-2022-0017. PMID 35291645.
16. Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains. *Sports Med.* 2026;56(2):481-505. doi:10.1007/s40279-025-02344-w. PMID 41343037.
17. Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. *Strength Cond J.* 2016;38(4):42-49. doi:10.1519/SSC.0000000000000218. PMID 27531969.
18. Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. *Sports Med.* 2023;53(3):649-665. doi:10.1007/s40279-022-01784-y. PMID 36334240.
19. Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. *Sports Med.* 2016;46(11):1689-1697. doi:10.1007/s40279-016-0543-8. PMID 27102172.
20. American College of Sports Medicine. Position stand: progression models in resistance training for healthy adults. *Med Sci Sports Exerc.* 2009;41(3):687-708. doi:10.1249/MSS.0b013e3181915670. PMID 19204579.
21. Bull FC, Al-Ansari SS, Biddle S, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med.* 2020;54(24):1451-1462. doi:10.1136/bjsports-2020-102955. PMID 33239350.
22. Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. *J Sport Health Sci.* 2024;13(1):6-12. doi:10.1016/j.jshs.2023.10.010. PMID 38242596. Values: https://pacompendium.com
23. Butte NF, Watson KB, Ridley K, et al. A Youth Compendium of Physical Activities: activity codes and metabolic intensities. *Med Sci Sports Exerc.* 2018;50(2):246-256. doi:10.1249/MSS.0000000000001430. PMID 28938248.
24. Garber CE, Blissmer B, Deschenes MR, et al. American College of Sports Medicine position stand. Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults. *Med Sci Sports Exerc.* 2011;43(7):1334-59. doi:10.1249/MSS.0b013e318213fefb. PMID 21694556.
25. Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. *J Am Coll Cardiol.* 2001;37(1):153-6. doi:10.1016/s0735-1097(00)01054-8. PMID 11153730.
26. Watson NF, Badr MS, Belenky G, et al. Joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society on the recommended amount of sleep for a healthy adult. *J Clin Sleep Med.* 2015;11(8):931-52. doi:10.5664/jcsm.4950. PMID 26235159.
27. Hirshkowitz M, Whiton K, Albert SM, et al. National Sleep Foundation's sleep time duration recommendations: methodology and results summary. *Sleep Health.* 2015;1(1):40-43. doi:10.1016/j.sleh.2014.12.010. PMID 29073412.
28. Paruthi S, Brooks LJ, D'Ambrosio C, et al. Recommended amount of sleep for pediatric populations: a consensus statement of the American Academy of Sleep Medicine. *J Clin Sleep Med.* 2016;12(6):785-6. doi:10.5664/jcsm.5866. PMID 27250809.
29. Institute of Medicine. *Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate.* National Academies Press, 2005. Chapter 4.
30. Golden NH, Schneider M, Wood C; AAP Committee on Nutrition, Committee on Adolescence, Section on Obesity. Preventing obesity and eating disorders in adolescents. *Pediatrics.* 2016;138(3):e20161649. doi:10.1542/peds.2016-1649. PMID 27550979.
31. Hampl SE, Hassink SG, Skinner AC, et al. Clinical practice guideline for the evaluation and treatment of children and adolescents with obesity. *Pediatrics.* 2023;151(2):e2022060640. doi:10.1542/peds.2022-060640. PMID 36622115.
32. Centers for Disease Control and Prevention. CDC Growth Charts data files, BMI-for-age (2 to 20 years). https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv
33. US Office on Women's Health, National Eating Disorders Awareness Week 2026 resources (https://womenshealth.gov/nedaw/resources); ANAD (https://anad.org); National Alliance for Eating Disorders (https://www.allianceforeatingdisorders.com).
34. Burke LE, Wang J, Sevick MA. Self-monitoring in weight loss: a systematic review of the literature. *J Am Diet Assoc.* 2011;111(1):92-102. doi:10.1016/j.jada.2010.10.008. PMID 21185970.

35. Cunningham JJ. Body composition as a determinant of energy expenditure: a synthetic review and a proposed general prediction equation. *Am J Clin Nutr.* 1991;54(6):963-9. doi:10.1093/ajcn/54.6.963. PMID 1957828.
36. Westerterp KR. Physical activity and physical activity induced energy expenditure in humans: measurement, determinants, and effects. *Front Physiol.* 2013;4:90. doi:10.3389/fphys.2013.00090. PMID 23637685.
37. Black AE, Coward WA, Cole TJ, Prentice AM. Human energy expenditure in affluent societies: an analysis of 574 doubly-labelled water measurements. *Eur J Clin Nutr.* 1996;50(2):72-92. PMID 8641250.
38. Lichtman SW, Pisarska K, Berman ER, et al. Discrepancy between self-reported and actual caloric intake and exercise in obese subjects. *N Engl J Med.* 1992;327(27):1893-8. doi:10.1056/NEJM199212313272701. PMID 1454084.
39. Orsama AL, Mattila E, Ermes M, et al. Weight rhythms: weight increases during weekends and decreases during weekdays. *Obes Facts.* 2014;7(1):36-47. doi:10.1159/000356147. PMID 24504358.
40. Hector AJ, Phillips SM. Protein recommendations for weight loss in elite athletes: a focus on body composition and performance. *Int J Sport Nutr Exerc Metab.* 2018;28(2):170-177. doi:10.1123/ijsnem.2017-0273. PMID 29182451.
41. Longland TM, Oikawa SY, Mitchell CJ, Devries MC, Phillips SM. Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss: a randomized trial. *Am J Clin Nutr.* 2016;103(3):738-46. doi:10.3945/ajcn.115.119339. PMID 26817506.
42. Phillips SM, Chevalier S, Leidy HJ. Protein "requirements" beyond the RDA: implications for optimizing health. *Appl Physiol Nutr Metab.* 2016;41(5):565-72. doi:10.1139/apnm-2015-0550. PMID 26960445.
43. Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. *J Strength Cond Res.* 2006;20(3):584-92. doi:10.1519/R-15304.1. PMID 16937972.
44. Shcherbina A, Mattsson CM, Waggott D, et al. Accuracy in wrist-worn, sensor-based measurements of heart rate and energy expenditure in a diverse cohort. *J Pers Med.* 2017;7(2):3. doi:10.3390/jpm7020003. PMID 28538708.
45. Fuller D, Colwell E, Low J, et al. Reliability and validity of commercially available wearable devices for measuring steps, energy expenditure, and heart rate: systematic review. *JMIR Mhealth Uhealth.* 2020;8(9):e18694. doi:10.2196/18694. PMID 32897239.
46. Zhang D, Shen X, Qi X. Resting heart rate and all-cause and cardiovascular mortality in the general population: a meta-analysis. *CMAJ.* 2016;188(3):E53-E63. doi:10.1503/cmaj.150535. PMID 26598376.
47. Jensen MD, Ryan DH, Apovian CM, et al. 2013 AHA/ACC/TOS guideline for the management of overweight and obesity in adults. *Circulation.* 2014;129(25 Suppl 2):S102-38. doi:10.1161/01.cir.0000437739.71477.ee. PMID 24222017.
48. Neumark-Sztainer D, Wall M, Guo J, Story M, Haines J, Eisenberg M. Obesity, disordered eating, and eating disorders in a longitudinal study of adolescents: how do dieters fare 5 years later? *J Am Diet Assoc.* 2006;106(4):559-68. doi:10.1016/j.jada.2006.01.003. PMID 16567152.

## How this file was checked (October 2026)

- Every numbered reference was looked up in PubMed (or on the issuing body's own site) to confirm authors, journal, year and identifier.
- Figures marked **High** were read in the abstract or full text: the Morton break point and interval, the WHO activity recommendations, the AHA/ACC/TOS calorie ranges, the Schofield equations and PAL bands (FAO), the Cunningham equation, the protein ranges in [40] to [42], the wearable findings in [44] and [45], the rep limit in [43], the resting heart-rate meta-analysis, the adult water intakes, and every MET value against the Compendium's site.
- A change made as a result: the activity multipliers were replaced, and the rep limit for 1RM estimates was lowered from 12 to 10.

## Still not verified, and labelled as such above

- The ACSM heart-rate zone edges, confirmed only through other papers that reproduce the position stand's table.
- The Epley and Brzycki source publications, which are not in PubMed.
- Reference [48]'s specific findings: the citation was confirmed, the abstract's results section was not retrieved, and the one-line summary above is from memory of the paper.
- Reference [39]'s detail beyond its title.
- The Dietary Guidelines' own wording for fibre (14 g per 1,000 kcal); the figure was confirmed in secondary sources that attribute it to the DRI.
- Any claim about nutrient timing, meal frequency or supplements. The app makes no recommendations on these.
