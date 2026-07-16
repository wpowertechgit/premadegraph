# Tribal NeuroSim Bibliography Notes

## Purpose

This file collects candidate bibliography sources for the subchapters proposed in `tribal-neurosim-subchapter-fit-draft.md`.

The goal is not to inflate the reference list. The goal is to give each major claim family at least one defensible foundational source and, where useful, one method or validation-oriented companion source.

This note is intentionally thesis-writing support, not final bibliography formatting.

## Recommended Use

- use foundational sources for concept-definition claims;
- use method or design sources for implementation-framing claims;
- keep simulation-specific claims grounded in local project validation docs;
- avoid citing broad theory for claims that really depend on your own implementation logs.

## Preferred Thesis Set For The Whole Draft

If the goal is to support `tribal-neurosim-subchapter-fit-draft.md` with the most usable and least bloated bibliography, prefer this compact set as the default citation spine:

1. `bonabeau2002`
   Use for Agent-Based Modeling as the high-level scientific framing.

2. `wooldridgejennings1995`
   Use for Multi-Agent Systems, autonomy, and decentralized agent behavior.

3. `maynardsmithprice1973`
   Use for Hawk-Dove and formal strategic conflict framing.

4. `maynardsmith1982`
   Use for broader game-theoretic context when one paper is too narrow.

5. `stanleymiikkulainen2002`
   Use for NEAT and neuroevolution.

6. `newman2003`
   Use for assortativity / mixing language and connected-node similarity.

7. `girvannewman`
   Use for community/network structure language where needed.

8. `hart1968`
   Use only when the chapter explicitly discusses heuristic pathfinding logic.

9. `munzner2009`
   Use for visualization as an analytical and validation-oriented interface.

10. `fowler2005`
    Use for event sourcing / replay / auditability vocabulary.

11. `jung2020`
    Use for Rust as a systems-programming and safety/performance choice.

12. `brandes2001`
    Use for centrality-computation cost and graph-analytics performance relevance.

This set is intentionally smaller than the full candidate pool. It covers almost every conceptual claim family in the draft without making the references section look scattered.

## 1. Agent-Based Modeling and Computational Social Science

### Best Core Sources

1. Bonabeau, E. (2002). `Agent-based modeling: Methods and techniques for simulating human systems.` *Proceedings of the National Academy of Sciences*, 99(suppl. 3), 7280-7287.
   Link: https://doi.org/10.1073/pnas.082080899

2. Epstein, J. M. (2006). `Generative Social Science: Studies in Agent-Based Computational Modeling.`
   Link: https://press.princeton.edu/books/paperback/9780691125473/generative-social-science

3. Macy, M. W., and Willer, R. (2002). `From Factors to Actors: Computational Sociology and Agent-Based Modeling.` *Annual Review of Sociology*, 28, 143-166.
   Link: https://doi.org/10.1146/annurev.soc.28.110601.141117

### What These Defend

- ABM as a valid way to study macro-patterns emerging from local interaction
- computational social science framing without requiring a single global optimizer
- the idea that agent populations can produce interpretable collective outcomes

### Best Use In Your Chapter

Use Bonabeau for the general ABM definition and methods framing, Macy and Willer for the computational sociology / emergence argument, and Epstein if you want a stronger "generative" theory layer.

## 2. Multi-Agent Systems

### Best Core Sources

1. Wooldridge, M., and Jennings, N. R. (1995). `Intelligent Agents: Theory and Practice.` *The Knowledge Engineering Review*, 10(2), 115-152.
   Link: https://www.cs.ox.ac.uk/people/michael.wooldridge/pubs/ker95/ker95-html.html

2. Wooldridge, M. (2009). `An Introduction to MultiAgent Systems` (2nd ed.).
   Link: https://www.wiley-vch.de/en/areas-interest/computing-computer-sciences/an-introduction-to-multiagent-systems-978-0-470-51946-2

3. Jennings, N. R., Sycara, K., and Wooldridge, M. (1998). `A Roadmap of Agent Research and Development.` *Autonomous Agents and Multi-Agent Systems*, 1, 7-38.
   Link: https://doi.org/10.1023/A:1010090405266

### What These Defend

- autonomy, reactivity, pro-activeness, and social interaction as agent properties
- decentralized decision-making in shared environments
- MAS as the right framing when many agents interact without a central planner

### Best Use In Your Chapter

Use Wooldridge and Jennings for the definitional layer. Use the Wooldridge book when you want a stable textbook citation instead of only an older survey article.

## 3. Game Theory and Strategic Interaction

### Best Core Sources

1. Maynard Smith, J., and Price, G. R. (1973). `The Logic of Animal Conflict.` *Nature*, 246, 15-18.
   Link: https://doi.org/10.1038/246015a0

2. Maynard Smith, J. (1982). `Evolution and the Theory of Games.`
   Link: https://www.cambridge.org/core/books/evolution-and-the-theory-of-games/0E1E584C0C1A3F1A576D98AAE2E2A2A8

3. Gintis, H. (2000). `Game Theory Evolving.`
   Link: https://press.princeton.edu/books/paperback/9780691009438/game-theory-evolving

### What These Defend

- Hawk-Dove as a legitimate formal lens for conflict and retreat
- payoff ordering such as `T > R > P > S`
- strategic interaction claims without needing to claim full analytical equilibrium solving in the simulator

### Best Use In Your Chapter

Use Maynard Smith and Price for the original Hawk-Dove grounding. Use Maynard Smith's book if you want the section to sound more academically complete than a single Nature citation.

### Preferred Thesis Set

If you want the most usable, least cluttered Hawk-Dove bibliography for this project, prefer exactly these two:

1. `maynardsmithprice1973`
   Use for the original Hawk-Dove / animal-conflict grounding.

2. `maynardsmith1982`
   Use when you need a broader game-theory framing or a more stable book citation for the chapter.

Keep `Gintis (2000)` as optional overflow, not as a default citation, unless a section specifically benefits from a modern pedagogical game-theory text.

## 4. Neuroevolution

### Best Core Sources

1. Stanley, K. O., and Miikkulainen, R. (2002). `Evolving Neural Networks through Augmenting Topologies.` *Evolutionary Computation*, 10(2), 99-127.
   Link: https://doi.org/10.1162/106365602320169811

2. Stanley, K. O., and Miikkulainen, R. (2004). `Competitive Coevolution through Evolutionary Complexification.` *Journal of Artificial Intelligence Research*, 21, 63-100.
   Link: https://doi.org/10.1613/jair.1418

3. Holland, J. H. (1992 edition). `Adaptation in Natural and Artificial Systems.`
   Link: https://direct.mit.edu/books/monograph/2574/Adaptation-in-Natural-and-Artificial-SystemsAn

### What These Defend

- neuroevolution as distinct from gradient-based training
- topology-and-weight evolution
- mutation, selection, and adaptation as principled evolutionary-computation mechanisms

### Best Use In Your Chapter

Use Stanley and Miikkulainen 2002 as the mandatory NEAT citation. Use Holland if you want a deeper foundational bridge to evolutionary computation more generally.

## 5. Graph Theory and Network Science

### Best Core Sources

1. Newman, M. E. J. (2010). `Networks: An Introduction.`
   Link: https://academic.oup.com/book/27303

2. Newman, M. E. J. (2003). `Mixing Patterns in Networks.` *Physical Review E*, 67, 026126.
   Link: https://doi.org/10.1103/PhysRevE.67.026126

3. Girvan, M., and Newman, M. E. J. (2002). `Community Structure in Social and Biological Networks.` *Proceedings of the National Academy of Sciences*, 99(12), 7821-7826.
   Link: https://doi.org/10.1073/pnas.122653799

4. Buneman, P., Khanna, S., and Tan, W.-C. (2001). `Why and Where: A Characterization of Data Provenance.`
   Link: https://doi.org/10.1007/3-540-45517-2_27

### What These Defend

- graph and network language for dynamic relations
- assortativity / mixing claims
- community and connectivity language
- lineage/provenance graph framing when discussing ancestry DAGs

### Best Use In Your Chapter

Use Newman as the backbone citation for network terminology. Use the 2003 assortativity paper specifically wherever you discuss mixing or similarity across connected nodes.

## 6. Computational Geometry and Spatial Pathfinding

### Best Core Sources

1. de Berg, M., van Kreveld, M., Overmars, M., and Schwarzkopf, O. (2008). `Computational Geometry: Algorithms and Applications` (3rd ed.).
   Link: https://link.springer.com/book/10.1007/978-3-662-04245-8

2. Hart, P. E., Nilsson, N. J., and Raphael, B. (1968). `A Formal Basis for the Heuristic Determination of Minimum Cost Paths.` *IEEE Transactions on Systems Science and Cybernetics*, 4(2), 100-107.
   Link: https://doi.org/10.1109/TSSC.1968.300136

3. Crooks, A. T., Castle, C. J. E., and Batty, M. (2008). `Key Challenges in Agent-Based Modelling for Geo-Spatial Simulation.` *Computers, Environment and Urban Systems*, 32(6), 417-430.
   Link: https://doi.org/10.1016/j.compenvurbsys.2008.09.004

### What These Defend

- geometry as a real computational substrate rather than visual decoration
- pathfinding and shortest-path reasoning
- spatial ABM claims about adjacency, movement, and local interaction over terrain

### Best Use In Your Chapter

Use de Berg for the computational geometry umbrella and Hart et al. only if you explicitly discuss heuristic pathfinding. Do not over-cite A* unless the exact implementation path truly uses it.

## 7. Event-Driven Architecture

### Best Core Sources

1. Fowler, M. (2005). `Event Sourcing.`
   Link: https://www.martinfowler.com/eaaDev/EventSourcing.html

2. Fowler, M. (2017). `What do you mean by "Event-Driven"?`
   Link: https://martinfowler.com/articles/201701-event-driven.html

3. Gacek, C., et al. (2021). `An Empirical Characterization of Event Sourced Systems and Their Schema Evolution: Lessons from Industry.` *Journal of Systems and Software*, 178, 110970.
   Link: https://doi.org/10.1016/j.jss.2021.110970

4. Freire, J., Koop, D., Santos, E., and Silva, C. T. (2008). `Provenance for Computational Tasks: A Survey.`
   Link: https://doi.org/10.1109/MCSE.2008.79

### What These Defend

- append-only event logs as a legitimate architectural pattern
- replay / reconstruction / auditability claims
- the practical trade-offs of event-sourced systems
- provenance and explainability language for simulation histories

### Best Use In Your Chapter

Fowler is enough for architecture vocabulary. Add Freire et al. when you want a more research-facing argument about provenance and post-run interpretability.

## 8. Scientific Visualization and Human-Computer Interaction

### Best Core Sources

1. Munzner, T. (2014). `Visualization Analysis and Design.`
   Link: https://www.routledge.com/Visualization-Analysis-and-Design/Munzner/9781466508910

2. Munzner, T. (2009). `A Nested Model for Visualization Design and Validation.` *IEEE Transactions on Visualization and Computer Graphics*, 15(6), 921-928.
   Link: https://www.cs.ubc.ca/labs/imager/tr/2009/NestedModel/

3. Ware, C. (2020). `Information Visualization: Perception for Design` (4th ed.).
   Link: https://www.sciencedirect.com/book/9780128128756/information-visualization

### What These Defend

- visualization as an analytical instrument, not just polish
- semantic zoom / multi-level view design logic
- the HCI/perception basis for inspectable simulation interfaces

### Best Use In Your Chapter

Use Munzner 2009 if you want to justify layered design and validation language. Use Munzner's book or Ware when arguing that the interface improves inspection and cognition rather than just appearance.

## 9. Systems Programming and High-Performance Computing

### Best Core Sources

1. Jung, R., et al. (2020). `Safe Systems Programming in Rust.` *Communications of the ACM*, 64(4), 144-152.
   Link: https://cacm.acm.org/research/safe-systems-programming-in-rust/

2. Klabnik, S., and Nichols, C. (2019). `The Rust Programming Language.`
   Link: https://doc.rust-lang.org/book/

3. McKenney, P. E. (2024). `Is Parallel Programming Hard, And, If So, What Can You Do About It?`
   Link: https://www.kernel.org/pub/linux/kernel/people/paulmck/perfbook/perfbook.html

4. Brandes, U. (2001). `A Faster Algorithm for Betweenness Centrality.` *Journal of Mathematical Sociology*, 25(2), 163-177.
   Link: https://doi.org/10.1080/0022250X.2001.9990249

### What These Defend

- Rust as a systems-language choice with safety/performance relevance
- deterministic systems implementation language for low-level simulation work
- algorithmic-performance framing for graph analytics
- parallel/performance claims that should be measured rather than hand-waved

### Best Use In Your Chapter

Use Jung et al. for the strongest research-facing Rust citation. Use Brandes when the chapter crosses from general systems claims into graph-analytics cost and centrality computation.

## Minimal "Do Not Overclaim" Notes

- ABM citations do not prove your simulation is valid by themselves; they only justify the modeling family.
- Hawk-Dove citations do not mean your simulator solves equilibria unless you explicitly formalize strategies and payoffs.
- NEAT citations do not prove your current implementation is faithful unless your code actually uses those mechanics.
- visualization citations justify interpretability and design logic, not empirical correctness.
- Rust/systems citations justify the language and architecture direction, not performance success without benchmarks.

## Likely Next Step

The clean next step is to convert the strongest subset of these into `docs/latex/references.tex` entries and then add inline citation markers into the subchapter draft where claims are currently unsupported.
