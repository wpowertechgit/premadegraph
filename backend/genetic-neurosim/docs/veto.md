# Veto List:
## 1.War : 
part , i already said my opinion, its correct. by the way, there should be a natural unsettling feeling, like these tribes are not pacifist, they are goidamen. also wars can be triggered by one tribe's conquest and imperialistic plans. if a tribe has a smaller neighbour, naturally its an instinct that it wants to absorb it or conquer it to make them a subordinate. thats the whole point of the simulation, survival of the fittest in the very end. either with a peaceful resolution , or with total annihilation of the weaker one, obviously war should weaken both parties , so if an entity comes out of a war victorious a 3rd one might take the chance to declare war on them (if they have a reason)
## 2. Absorption / Meger
this is fine
## 3. Polity tier Upgrades
If it was not obvious, the Duchy tier is the County , not sure why it renamed it and got the idea of county. but we only need 5 tiers. Yup the population based promotion is not yet implemented. This document's intent was to create a whole picture of what needs to be done. 3a A tribe with 500 population and 40 tiles but zero mergers stays at Tribe tier forever. If this is intended behavior, mark correct. Well a tribe should not be able to claim 40 tiles , wtf, that is very high tier amount of land, a tribe should have max the adjacent tiles. lmao, so like 6 additional hexes, maximum, and of course we could talk about more when it naturally evolved into a higher tier. 3c about the downgrade , that is never supposed to happen, on its own. With a rebelion, well if it is about splitting up the sovereignity , then yes, it would split into the higher tiers possible. So if part A of the kingdom has a city level of population and part B of the population of a Duchy level of population and part C has a tribe level of population , then yes it could split into those. But on its own, when a city loses its population, its an extinction event, if it cant hold up its needs. 3b!!! ignore !!! county = duchy!!!!
## 4. The five artifacts
veto:
`a_map_objective` and `a_team` are **intentionally not in the neural input list** per the original spec — they drive role assignment and rebellion threshold, not neural behavior - these are neural behavior too, the neural network decides, about the unity and the imperialistic decisions (like conquest) based on these factors. Also later on we need the full model of the neural network, (atleast on a diagram level, draft the puml of it so we can present it in the final documentation), and a description of how it works internally, what machine learning experiences does it use.
Artifact blending on reproduction ✅ - lets call this mutation.
## 5. Territory
yes, this is ok i agree with what you wrote. eventually the disputes with time , they should increase the tensions so one backs off, or one attacks at one point.
## 6. Surrounding / Trapped Tribes
Oh this is  interesting. Hermit kingdoms are definetly fun (think about switzerland) but in our current scenario, this could only work, if it has imperialistic goals (after all , a last man standing scenario is what we are looking for) . like if one of these landlocked tribes have enough stats, they could go contest adjancent tiles. maybe if the other kingdom does not rely on it as much. then it could cede, if the neural network decides its not worth the fight, and if its not a threat to their survival.

## 7. C# Local Demo vs Rust Backend

wow this got complicated more than it should have, basically the game behaviour in the C# that is already happening, and what will happen in the future, after we are in scope again. should be the same one in the rust. like bro basically the C# demo should communicate with the rust backend, ALREADY, and it baffles me that it doesnt yet. xd like what have we done in the rust so far?? xdd, did we just never use that ? bruh.
Basicall C# demo from the dotnet run : applies logic from rust. if that is not the case yet, then honestly im clueless about what on earth is happening, it seems to me that we went on two different tracks completely with the two systems, when they should be one.

## 8. Lineage
ok now that i got omega confused, i have no clue how it is wired right now, the whole lineage system.
man it should be simple  : dotnet run means we can try it on normal parameters. when dotnet run{dataset} or some shit is called from the node. it wires the dataset from the backend with each cluster being a tribe with its own artifacts. (the one we defined earlier)

## 9. Tier naming
COUNTY = DUCHY , DUCHY IS WHAT WE USE

## 10. Veterancy XP Downstream

Every 700-1000 (randomly) tick, we just improve the artifact value, tats it. what the fuck is so complicated about it.


##  11. Food Economy
note : starvation should occur if the tribe is too lazy for agriculture. yea ok. 


